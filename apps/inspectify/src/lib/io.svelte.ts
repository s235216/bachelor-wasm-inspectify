import { ce_shell, api, type ce_core } from './api';
import { browser } from '$app/environment';

type Mapping = { [A in ce_shell.Analysis]: (ce_shell.Envs & { analysis: A })['io'] };

type OutputState = 'None' | 'Stale' | 'Current';

export type Input<A extends ce_shell.Analysis> = Mapping[A]['input'];
export type Output<A extends ce_shell.Analysis> = Mapping[A]['output'];
export type Meta<A extends ce_shell.Analysis> = Mapping[A]['meta'];
export type Annotation<A extends ce_shell.Analysis> = Mapping[A]['annotation'];

export type Results<A extends ce_shell.Analysis> = {
  input: Input<A>;
  outputState: OutputState;
  output: Output<A> | null;
  validation: ce_core.ValidationResult | { type: 'Failure'; message: string } | null;
  annotation: Annotation<A> | null;
};

const defaultResults = <A extends ce_shell.Analysis>(): Results<A> => ({
  input: null as any,
  outputState: 'None',
  output: null,
  validation: null,
  annotation: null,
});

export class Io<A extends ce_shell.Analysis> {
  analysis: A;
  input: Input<A> = $state(null as any);
  meta: Meta<A> | null = $state(null);
  reference: Results<A> = $state(defaultResults());

  constructor(analysis: A, defaultInput: Input<A>, seed?: number) {
    this.analysis = analysis;
    this.input = defaultInput;

    if (!browser) return;

    const params = new URLSearchParams(window.location.search);
    if (typeof seed != 'number') {
      const paramSeed = params.get('seed');
      if (typeof paramSeed == 'string') {
        seed = parseInt(paramSeed);
      }
    }

    $effect(() => {
      if (!browser) return;

      const analysisRequest = api.reference({
        analysis,
        json: this.input,
        // TODO: we should avoid this somehow
        hash: { bytes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      });

      analysisRequest.data.then(({ output, error, meta, annotation }) => {
        this.meta = meta.json;
        this.reference = {
          input: this.input,
          outputState: 'Current',
          output: output?.json as any,
          validation: { type: 'Correct' },
          annotation: annotation?.json as any,
        };
      });
    });

    this.generate(seed);
  }

  async generate(seed?: number): Promise<Input<A>> {
    const result = await api.generate({ analysis: this.analysis, seed: seed ?? null }).data;
    this.input = result.json as any;
    return result.json as any;
  }
}
