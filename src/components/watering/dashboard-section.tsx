import { Separator } from "@/components/ui/separator";
import type { DashboardPlant } from "@/types/plants";

interface DashboardSectionProps {
  title: string;
  plants: DashboardPlant[];
  showSeparator: boolean;
  renderCard: (plant: DashboardPlant) => React.ReactNode;
}

export function DashboardSection({
  title,
  plants,
  showSeparator,
  renderCard,
}: DashboardSectionProps) {
  if (plants.length === 0) return null;

  return (
    <section>
      {showSeparator && <Separator className="my-xl" />}
      <div className="space-y-sm">
        <h2 className="text-base font-semibold">
          {title}{" "}
          <span className="text-muted-foreground font-normal">
            ({plants.length})
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {plants.map((plant) => renderCard(plant))}
        </div>
      </div>
    </section>
  );
}
