use ce_core::{Env, Generate, ValidationResult, define_env, rand};
use gcl::{ast::Commands, interpreter::InterpreterMemory};
use serde::{Deserialize, Serialize};
use stdx::stringify::Stringify;

define_env!(ParserEnv);

#[derive(tapi::Tapi, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[tapi(path = "Parser")]
pub struct Input {
    commands: Stringify<Commands>,
}

#[derive(tapi::Tapi, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[tapi(path = "Parser")]
pub struct Output {
    pretty: Stringify<Commands>,
}

use rand::SeedableRng;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReferenceExecution {
    meta: Option<<ParserEnv as Env>::Meta>,
    output: Option<Output>,
    annotation: Option<<ParserEnv as Env>::Annotation>,
    error: Option<String>,
}

#[wasm_bindgen]
pub async fn parser_wasm_reference(input_json: String) -> Option<String> {
    let input_result: Result<Input, serde_json::Error> = serde_json::from_str(&input_json);
    let res = match input_result {
        Ok(input) => {
            let meta = Some(ParserEnv::meta(&input));
            let output = ParserEnv::run(&input);
            let error = output.as_ref().err().map(|e| e.to_string());
            let output = output.ok();
            let annotation = output
                .as_ref()
                .and_then(|o| ParserEnv::validate(&input, o).ok())
                .map(|(_, ann)| ann);
            ReferenceExecution { meta, output, annotation, error }
        }
        Err(e) => ReferenceExecution { 
            output: None,
            meta: None,
            annotation: None,
            error: Some(e.to_string())
        }
    };
    serde_json::to_string(&res).ok()
}

#[wasm_bindgen]
pub async fn parser_wasm_generate(seed: Option<u64>) -> Option<String> {
    let mut rng = match seed {
            Some(seed) => rand::rngs::SmallRng::seed_from_u64(seed),
            None => rand::rngs::SmallRng::from_os_rng(),
        };
    serde_json::to_string(&Input::gn(&mut (), &mut rng)).ok()
}


impl Env for ParserEnv {
    type Input = Input;

    type Output = Output;

    type Meta = ();

    type Annotation = ();

    fn run(input: &Self::Input) -> ce_core::Result<Self::Output> {
        Ok(Output {
            pretty: Stringify::new(input.commands.try_parse().map_err(
                ce_core::EnvError::invalid_input_for_program("failed to parse commands"),
            )?),
        })
    }

    fn validate(
        input: &Self::Input,
        output: &Self::Output,
    ) -> ce_core::Result<(ValidationResult, ())> {
        let (o_cmds, t_cmds) = match (
            Self::run(input)?.pretty.try_parse(),
            output.pretty.try_parse(),
        ) {
            (Ok(ours), Ok(theirs)) => (ours, theirs),
            (Err(err), _) | (_, Err(err)) => {
                return Ok((
                    ValidationResult::Mismatch {
                        reason: format!("failed to parse pretty output: {err:?}"),
                    },
                    (),
                ));
            }
        };

        if !check_programs_for_semantic_equivalence(&o_cmds, &t_cmds) {
            return Ok((
                ValidationResult::Mismatch {
                    reason: concat!(
                        "the pretty printed program is not semantically equivalent ",
                        "to the original program"
                    )
                    .to_string(),
                },
                (),
            ));
        }

        Ok((ValidationResult::Correct, ()))
    }
}

impl Generate for Input {
    type Context = ();

    fn gn<R: rand::Rng>(_cx: &mut Self::Context, rng: &mut R) -> Self {
        Self {
            commands: Stringify::new(Commands::gn(&mut Default::default(), rng)),
        }
    }
}

fn check_programs_for_semantic_equivalence(p1: &Commands, p2: &Commands) -> bool {
    let pg1 = gcl::pg::ProgramGraph::new(gcl::pg::Determinism::Deterministic, p1);
    let pg2 = gcl::pg::ProgramGraph::new(gcl::pg::Determinism::Deterministic, p2);

    let n_samples = 10;
    let n_steps = 10;

    let mut rng = <rand::rngs::SmallRng as rand::SeedableRng>::seed_from_u64(0xCEC34);

    for _ in 0..n_samples {
        let assignment = generate_input_assignment(p1, &mut rng);

        let mut exe1 = gcl::interpreter::Execution::new(assignment.clone());
        let mut exe2 = gcl::interpreter::Execution::new(assignment.clone());

        for _ in 0..n_steps {
            match (exe1.nexts(&pg1).first(), exe2.nexts(&pg2).first()) {
                (Some(next1), Some(next2)) => {
                    exe1 = next1.clone();
                    exe2 = next2.clone();
                }
                (None, None) => break,
                // NOTE: one of the executions is stuck while the other is not
                _ => return false,
            }
        }

        if exe1.current_mem() != exe2.current_mem() {
            return false;
        }
    }

    true
}

fn generate_input_assignment(
    commands: &gcl::ast::Commands,
    mut rng: &mut impl rand::Rng,
) -> InterpreterMemory {
    let initial_memory = gcl::memory::Memory::from_targets_with(
        commands.fv(),
        &mut rng,
        |rng, _| rng.random_range(-10..=10),
        |rng, _| {
            let len = rng.random_range(5..=10);
            (0..len).map(|_| rng.random_range(-10..=10)).collect()
        },
    );
    InterpreterMemory {
        variables: initial_memory.variables,
        arrays: initial_memory.arrays,
    }
}
