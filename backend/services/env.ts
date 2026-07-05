interface RuntimeProcess {
  readonly env?: Readonly<Record<string, string | undefined>>;
}

interface RuntimeGlobal {
  readonly process?: RuntimeProcess;
}

const runtimeGlobal = globalThis as RuntimeGlobal;

export function getEnvValue(name: string): string | undefined {
  const value = runtimeGlobal.process?.env?.[name];

  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}
