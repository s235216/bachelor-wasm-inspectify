mod dot;

use std::collections::{BTreeMap, BTreeSet};

use ce_core::{Env, Generate, ValidationResult, define_env};
use gcl::{
    ast::Commands,
    interpreter::InterpreterMemory,
    pg::{Determinism, ProgramGraph},
};
use itertools::Itertools;
use rand::{Rng, seq::IndexedRandom};
use serde::{Deserialize, Serialize};
use stdx::stringify::Stringify;

define_env!(CompilerEnv);

#[derive(tapi::Tapi, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[tapi(path = "Compiler")]
pub struct Input {
    pub commands: Stringify<Commands>,
    pub determinism: Determinism,
}

#[derive(tapi::Tapi, Debug, Clone, PartialEq, Serialize, Deserialize)]
#[tapi(path = "Compiler")]
pub struct Output {
    pub dot: String,
}

use rand::SeedableRng;
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReferenceExecution {
    meta: Option<<CompilerEnv as Env>::Meta>,
    output: Option<Output>,
    annotation: Option<<CompilerEnv as Env>::Annotation>,
    error: Option<String>,
}

#[wasm_bindgen]
pub fn compiler_wasm_reference(input_json: String) -> Option<String> {
    let input_result: Result<Input, serde_json::Error> = serde_json::from_str(&input_json);
    let res = match input_result {
        Ok(input) => {
            let meta = Some(CompilerEnv::meta(&input));
            let output = CompilerEnv::run(&input);
            let error = output.as_ref().err().map(|e| e.to_string());
            let output = output.ok();
            let annotation = output
                .as_ref()
                .and_then(|o| CompilerEnv::validate(&input, o).ok())
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
pub fn compiler_wasm_generate(seed: Option<u64>) -> Option<String> {
    let mut rng = match seed {
            Some(seed) => rand::rngs::SmallRng::seed_from_u64(seed),
            None => rand::rngs::SmallRng::from_os_rng(),
        };
    serde_json::to_string(&Input::gn(&mut (), &mut rng)).ok()
}

impl Env for CompilerEnv {
    type Input = Input;

    type Output = Output;

    type Meta = ();

    type Annotation = ();

    fn run(input: &Self::Input) -> ce_core::Result<Self::Output> {
        let dot =
            ProgramGraph::new(
                input.determinism,
                &input.commands.try_parse().map_err(
                    ce_core::EnvError::invalid_input_for_program("failed to parse commands"),
                )?,
            )
            .dot();
        Ok(Output { dot })
    }

    fn validate(
        input: &Self::Input,
        output: &Self::Output,
    ) -> ce_core::Result<(ValidationResult, ())> {
        let commands =
            input
                .commands
                .try_parse()
                .map_err(ce_core::EnvError::invalid_input_for_program(
                    "failed to parse commands",
                ))?;
        let o_dot = ProgramGraph::new(input.determinism, &commands).dot();

        let mut rng = <rand::rngs::SmallRng as rand::SeedableRng>::seed_from_u64(0xCEC34);
        let sample_mems = (0..10)
            .map(|_| {
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
            })
            .collect_vec();

        let t_g = match dot::dot_to_petgraph(&output.dot) {
            Ok(t_g) => t_g,
            Err(err) => {
                return Ok((
                    ValidationResult::Mismatch {
                        reason: format!("failed to parse dot: {err}"),
                    },
                    (),
                ));
            }
        };
        let o_g = dot::dot_to_petgraph(&o_dot).expect("we always produce valid dot");

        if action_bag(&o_g, &sample_mems) != action_bag(&t_g, &sample_mems) {
            Ok((
                ValidationResult::Mismatch {
                    reason: "the graphs have different structure".to_string(),
                },
                (),
            ))
        } else {
            Ok((ValidationResult::Correct, ()))
        }
    }
}

impl Generate for Input {
    type Context = ();

    fn gn<R: ce_core::rand::Rng>(_cx: &mut Self::Context, rng: &mut R) -> Self {
        let determinism = *[Determinism::Deterministic, Determinism::NonDeterministic]
            .choose(rng)
            .unwrap();

        Input {
            commands: Stringify::new(Commands::gn(&mut Default::default(), rng)),
            determinism,
        }
    }
}

fn action_bag(
    g: &dot::ParsedGraph,
    mems: &[InterpreterMemory],
) -> BTreeMap<[BTreeSet<Fingerprint>; 2], usize> {
    let mut counts = BTreeMap::new();

    for i in g.graph.node_indices() {
        let id = [petgraph::Incoming, petgraph::Outgoing].map(|dir| {
            g.graph
                .edges_directed(i, dir)
                .map(|e| fingerprint(e.weight(), mems))
                .collect()
        });
        *counts.entry(id).or_insert(0) += 1;
    }

    counts
}

type Fingerprint = (ActionKind, Vec<Option<InterpreterMemory>>);
fn fingerprint(a: &gcl::pg::Action, mems: &[InterpreterMemory]) -> Fingerprint {
    (
        a.into(),
        mems.iter().map(|mem| a.semantics(mem).ok()).collect(),
    )
}

impl From<&'_ gcl::pg::Action> for ActionKind {
    fn from(action: &'_ gcl::pg::Action) -> Self {
        match action {
            gcl::pg::Action::Assignment(t, _) => ActionKind::Assignment(t.clone().map_idx(|_| ())),
            gcl::pg::Action::Skip => ActionKind::Skip,
            gcl::pg::Action::Condition(_) => ActionKind::Condition,
        }
    }
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
enum ActionKind {
    Assignment(gcl::ast::Target<()>),
    Skip,
    Condition,
}
