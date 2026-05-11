use ce_shell::{Analysis, Annotation, Input, Meta, Output};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::*;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReferenceExecution {
    meta: Meta,
    output: Option<Output>,
    annotation: Option<Annotation>,
    error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct GenerateParams {
    analysis: Analysis,
    seed: Option<u64>,
}

fn wasm_reference(input_json: String) -> Option<ReferenceExecution> {
    let input: Input = serde_json::from_str(&input_json).ok()?;
    let output = input.reference_output();
    let error = output.as_ref().err().map(|e| e.to_string());
    let output = output.ok();
    let annotation = output
        .as_ref()
        .and_then(|o| input.validate_output(o).ok())
        .map(|(_, ann)| ann);
    Some(ReferenceExecution {
        meta: input.meta(),
        output,
        annotation,
        error,
    })
}

fn wasm_generate(input_json: String) -> Option<Input> {
    let params: GenerateParams = serde_json::from_str(&input_json).ok()?;
    Some(params.analysis.gen_input_seeded(params.seed))
}

#[wasm_bindgen]
pub async fn faux_api(path: i32, input_json: String) -> Option<String> {
    match path {
        0 => serde_json::to_string(&wasm_generate(input_json)).ok(),
        1 => serde_json::to_string(&wasm_reference(input_json)).ok(),
        _ => None
    }
}