import { canonicalMachineModels } from "./machine-profile-adapter";

type MachineCopy = {
  publicMachines: string;
  publicMachinesBody: string;
  machineProfile: string;
  machineBoundary: string;
};

export function MachineView({ copy }: { copy: MachineCopy }) {
  const machines = canonicalMachineModels();
  return (
    <section className="animate-rise py-6">
      <div className="glass-panel p-6 sm:p-8">
        <p className="eyebrow">Gardenpedia · Machines</p>
        <h2 className="mt-2 font-display text-3xl font-bold">{copy.publicMachines}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          {copy.publicMachinesBody}
        </p>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {machines.map((machine) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xl" aria-hidden="true">
                  ⚙️
                </span>
                <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">
                  {copy.publicMachines}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{machine.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{machine.modelNumber}</p>
              <p className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold">
                {machine.source.publisher}
                <span className="text-accent">{copy.machineProfile}</span>
              </p>
            </>
          );
          return (
            <a
              key={machine.id}
              href={`/gardenpedia#machine:${machine.id}`}
              className="glass-card block p-5 transition hover:-translate-y-0.5"
            >
              {body}
            </a>
          );
        })}
      </div>
      <div className="glass-panel mt-5 p-6 text-sm text-muted-foreground">
        {copy.machineBoundary}
      </div>
    </section>
  );
}
