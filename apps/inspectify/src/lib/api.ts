import calcInit, { calc_wasm_reference, calc_wasm_generate } from 'calculator-wasm-env';
import interpreterInit, { interpreter_wasm_reference, interpreter_wasm_generate } from 'interpreter-wasm-env';
import parserInit, { parser_wasm_reference, parser_wasm_generate } from 'parser-wasm-env';
import riscvInit, { riscv_wasm_reference, riscv_wasm_generate } from 'riscv-wasm-env';
import securityInit, { security_wasm_reference, security_wasm_generate } from 'security-wasm-env';
import signInit, { sign_wasm_reference, sign_wasm_generate } from 'sign-wasm-env';
import bigclInit, { bigcl_wasm_reference, bigcl_wasm_generate } from 'bigcl-wasm-env';
import compilerInit, { compiler_wasm_reference, compiler_wasm_generate } from 'compiler-wasm-env';

// Source - https://stackoverflow.com/a/76351967
// Posted by Douglas Meyer
// Retrieved 2026-04-14, License - CC BY-SA 4.0

const isType = <Type>(thing: any): thing is Type => true;

function getWasmRef(analysis: ce_shell.Analysis) {
  switch (analysis) {
    case 'Calculator': return calc_wasm_reference;
    case 'Parser': return parser_wasm_reference;
    case 'Compiler': return compiler_wasm_reference;
    case 'Interpreter': return interpreter_wasm_reference;
    case 'BiGCL': return bigcl_wasm_reference;
    case 'RiscV': return riscv_wasm_reference;
    case 'Security': return security_wasm_reference;
    case 'Sign': return sign_wasm_reference;
  }
}

function getWasmGen(analysis: ce_shell.Analysis) {
  switch (analysis) {
    case 'Calculator': return calc_wasm_generate;
    case 'Parser': return parser_wasm_generate;
    case 'Compiler': return compiler_wasm_generate;
    case 'Interpreter': return interpreter_wasm_generate;
    case 'BiGCL': return bigcl_wasm_generate;
    case 'RiscV': return riscv_wasm_generate;
    case 'Security': return security_wasm_generate;
    case 'Sign': return sign_wasm_generate;
  }
}

function getWasmInit(analysis: ce_shell.Analysis) {
  switch (analysis) {
    case 'Calculator': return calcInit; 
    case 'Parser': return parserInit;
    case 'Compiler': return compilerInit;
    case 'Interpreter': return interpreterInit; 
    case 'BiGCL': return bigclInit;
    case 'RiscV': return riscvInit;
    case 'Security': return securityInit;
    case 'Sign': return signInit;
  }
}

const request =
  <Req, Res>(
    path: ApiPath,
  ) =>
  (
    req: Req,
  ): { data: Promise<Res> } => {
    switch (path) {
      case ApiPath.Reference:
        if (!isType<ce_shell.io.Input>(req))
          break;
        return {
          data: (async () => {
            const res = await getWasmRef(req.analysis)(JSON.stringify(req.json));
            return res ? JSON.parse(res) : "" as Res;
          })()
        };
      
      case ApiPath.Generate:
        if (!isType<inspectify.endpoints.GenerateParams>(req))
          break;
        return {
          data: (async () => {
            await getWasmInit(req.analysis)();
            const res = await getWasmGen(req.analysis)(req.seed ? BigInt(req.seed) : null);
            return res ? JSON.parse(res) : "" as Res
          })()
        };
    }
    return {
      data: (async () => {
        return "" as Res
      })()
    };
  };

export namespace BiGCL {
  export type Input = {
    commands: string
  };
  export type Output = {
    binary: string
  };
}
export namespace Calculator {
  export type Input = {
    expression: string
  };
  export type Output = {
    result: string,
    error: string
  };
}
export namespace Compiler {
  export type Input = {
    commands: string,
    determinism: GCL.Determinism
  };
  export type Output = {
    dot: string
  };
}
export namespace GCL {
  export type Determinism =
    | "Deterministic"
    | "NonDeterministic";
  export const DETERMINISM: Determinism[] = ["Deterministic", "NonDeterministic"];
  export type TargetDef = {
    name: string,
    kind: GCL.TargetKind
  };
  export type TargetKind =
    | "Variable"
    | "Array";
  export const TARGET_KIND: TargetKind[] = ["Variable", "Array"];
  export type Variable = string;
  export type Array = string;
}
export namespace Interpreter {
  export type Input = {
    commands: string,
    determinism: GCL.Determinism,
    assignment: Interpreter.InterpreterMemory,
    trace_length: number
  };
  export type Output = {
    initial_node: string,
    final_node: string,
    dot: string,
    trace: Interpreter.Step[],
    termination: Interpreter.TerminationState
  };
  export type InterpreterMemory = {
    variables: Record<GCL.Variable, number>,
    arrays: Record<GCL.Array, number[]>
  };
  export type TerminationState =
    | "Running"
    | "Stuck"
    | "Terminated";
  export const TERMINATION_STATE: TerminationState[] = ["Running", "Stuck", "Terminated"];
  export type Step = {
    action: string,
    node: string,
    memory: Interpreter.InterpreterMemory
  };
}
export namespace Parser {
  export type Input = {
    commands: string
  };
  export type Output = {
    pretty: string
  };
}
export namespace RiscV {
  export type Input = {
    commands: string
  };
  export type Output = {
    assembly: string
  };
  export type Annotation = {
    pc: number,
    regs: Record<string, number>,
    variables: Record<string, [number, number]>,
    memory: number[]
  };
}
export namespace SecurityAnalysis {
  export type Input = {
    commands: string,
    classification: Record<string, string>,
    lattice: SecurityAnalysis.SecurityLatticeInput
  };
  export type Output = {
    actual: SecurityAnalysis.Flow[],
    allowed: SecurityAnalysis.Flow[],
    violations: SecurityAnalysis.Flow[],
    is_secure: boolean
  };
  export type Meta = {
    lattice: SecurityAnalysis.SecurityLattice,
    targets: GCL.TargetDef[]
  };
  export type SecurityLatticeInput = {
    rules: SecurityAnalysis.Flow[]
  };
  export type SecurityLattice = {
    allowed: SecurityAnalysis.Flow[]
  };
  export type Flow = {
    from: string,
    into: string
  };
}
export namespace SignAnalysis {
  export type Input = {
    commands: string,
    determinism: GCL.Determinism,
    assignment: SignAnalysis.SignMemory
  };
  export type Output = {
    initial_node: string,
    final_node: string,
    nodes: Record<string, SignAnalysis.SignMemory[]>,
    dot: string
  };
  export type SignMemory = {
    variables: Record<GCL.Variable, SignAnalysis.Sign>,
    arrays: Record<GCL.Array, SignAnalysis.Sign[]>
  };
  export type Sign =
    | "Positive"
    | "Zero"
    | "Negative";
  export const SIGN: Sign[] = ["Positive", "Zero", "Negative"];
}
export namespace ce_core {
  export type ValidationResult =
    | { "type": "Correct" }
    | { "type": "Unknown", reason: string }
    | { "type": "Mismatch", reason: string }
    | { "type": "TimeOut" };
}
export namespace ce_shell {
  export type Envs =
    | { "analysis": "Calculator", "io": { input: Calculator.Input, output: Calculator.Output, meta: void, annotation: void } }
    | { "analysis": "Parser", "io": { input: Parser.Input, output: Parser.Output, meta: void, annotation: void } }
    | { "analysis": "Compiler", "io": { input: Compiler.Input, output: Compiler.Output, meta: void, annotation: void } }
    | { "analysis": "Interpreter", "io": { input: Interpreter.Input, output: Interpreter.Output, meta: GCL.TargetDef[], annotation: void } }
    | { "analysis": "BiGCL", "io": { input: BiGCL.Input, output: BiGCL.Output, meta: void, annotation: void } }
    | { "analysis": "RiscV", "io": { input: RiscV.Input, output: RiscV.Output, meta: void, annotation: RiscV.Annotation } }
    | { "analysis": "Security", "io": { input: SecurityAnalysis.Input, output: SecurityAnalysis.Output, meta: SecurityAnalysis.Meta, annotation: void } }
    | { "analysis": "Sign", "io": { input: SignAnalysis.Input, output: SignAnalysis.Output, meta: GCL.TargetDef[], annotation: void } };
  export type Analysis =
    | "Calculator"
    | "Parser"
    | "Compiler"
    | "Interpreter"
    | "BiGCL"
    | "RiscV"
    | "Security"
    | "Sign";
  export const ANALYSIS: Analysis[] = ["Calculator", "Parser", "Compiler", "Interpreter", "BiGCL", "RiscV", "Security", "Sign"];
  export namespace io {
    export type Input = {
      analysis: ce_shell.Analysis,
      json: any,
      hash: ce_shell.io.Hash
    };
    export type Meta = {
      analysis: ce_shell.Analysis,
      json: any
    };
    export type Hash = {
      bytes: number[]
    };
    export type Output = {
      analysis: ce_shell.Analysis,
      json: any,
      hash: ce_shell.io.Hash
    };
    export type Annotation = {
      analysis: ce_shell.Analysis,
      json: any
    };
  }
}
export namespace driver {
  export namespace ansi {
    export type Color =
      | "Black"
      | "Red"
      | "Green"
      | "Yellow"
      | "Blue"
      | "Magenta"
      | "Cyan"
      | "White"
      | "Default"
      | "BrightBlack"
      | "BrightRed"
      | "BrightGreen"
      | "BrightYellow"
      | "BrightBlue"
      | "BrightMagenta"
      | "BrightCyan"
      | "BrightWhite";
    export const COLOR: Color[] = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White", "Default", "BrightBlack", "BrightRed", "BrightGreen", "BrightYellow", "BrightBlue", "BrightMagenta", "BrightCyan", "BrightWhite"];
  }
  export namespace job {
    export type JobId = number;
    export type JobState =
      | "Queued"
      | "Running"
      | "Succeeded"
      | "Canceled"
      | "Failed"
      | "Warning"
      | "Timeout"
      | "OutputLimitExceeded";
    export const JOB_STATE: JobState[] = ["Queued", "Running", "Succeeded", "Canceled", "Failed", "Warning", "Timeout", "OutputLimitExceeded"];
    export type JobKind =
      | { "kind": "Compilation" }
      | { "kind": "Analysis", "data": ce_shell.io.Input };
  }
}
export namespace inspectify {
  export namespace endpoints {
    export type ReferenceExecution = {
      meta: (any | null),
      output: (any | null),
      annotation: (any | null),
      error: (string | null)
    };
    export type GenerateParams = {
      analysis: ce_shell.Analysis,
      seed: (number | null)
    };
    export type CompilationStatus = {
      id: (driver.job.JobId | null),
      state: driver.job.JobState,
      error_output: (inspectify.endpoints.Span[] | null)
    };
    export type Job = {
      id: driver.job.JobId,
      state: driver.job.JobState,
      kind: driver.job.JobKind,
      stdout: string,
      spans: inspectify.endpoints.Span[],
      analysis_data: (inspectify.endpoints.AnalysisData | null)
    };
    export type Program = {
      hash: ce_shell.io.Hash,
      hash_str: string,
      input: ce_shell.io.Input
    };
    export type Span = {
      text: string,
      fg: (driver.ansi.Color | null),
      bg: (driver.ansi.Color | null)
    };
    export type AnalysisData = {
      meta: ce_shell.io.Meta,
      output: (ce_shell.io.Output | null),
      reference_output: (ce_shell.io.Output | null),
      validation: (ce_core.ValidationResult | null),
      annotation: (ce_shell.io.Annotation | null)
    };
  }
}

enum ApiPath {
  Generate,
  Reference
}

export const api = {
    generate: request<inspectify.endpoints.GenerateParams, ce_shell.io.Input>(ApiPath.Generate),
    reference: request<ce_shell.io.Input, inspectify.endpoints.ReferenceExecution>(ApiPath.Reference),
};
