import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPlants, getCatalog } from "@/features/plants/queries";
import { getRoomsForSelect } from "@/features/rooms/queries";
import { PlantGrid } from "@/components/plants/plant-grid";
import { AddPlantDialog } from "@/components/plants/add-plant-dialog";
import { SearchBar } from "@/components/plants/search-bar";
import { FilterChips } from "@/components/plants/filter-chips";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Leaf, Search as SearchIcon } from "lucide-react";

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    search?: string;
    status?: "overdue" | "due-today" | "upcoming" | "archived";
    sort?: "next-watering" | "name" | "recently-added";
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Timezone for status filter date boundaries (same pattern as dashboard/page.tsx)
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? "UTC";
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [plantsResult, catalog, rooms, totalPlantCount] = await Promise.all([
    getPlants(session.user.id, {
      roomId: params.room,
      search: params.search,
      status: params.status,
      sort: params.sort,
      todayStart,
      todayEnd,
      page: currentPage,
    }),
    getCatalog(),
    getRoomsForSelect(session.user.id),
    db.plant.count({ where: { userId: session.user.id, archivedAt: null } }),
  ]);

  // Redirect to page 1 if requested page is out of range
  if (currentPage > plantsResult.totalPages && plantsResult.totalPages > 0) {
    const redirectParams = new URLSearchParams();
    if (params.room) redirectParams.set("room", params.room);
    if (params.search) redirectParams.set("search", params.search);
    if (params.status) redirectParams.set("status", params.status);
    if (params.sort) redirectParams.set("sort", params.sort);
    const qs = redirectParams.toString();
    redirect(qs ? `/plants?${qs}` : "/plants");
  }

  const { plants, totalPages, currentPage: page } = plantsResult;

  const hasActiveFilters = !!(params.search || params.status || params.room);
  const activeRoom = params.room
    ? rooms.find((r) => r.id === params.room)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">My Plants</h1>
        <AddPlantDialog catalog={catalog} rooms={rooms} />
      </div>

      {/* Search, filter, sort block */}
      <div className="space-y-2">
        <SearchBar defaultValue={params.search} />
        <FilterChips
          rooms={rooms}
          activeRoomId={params.room}
          activeStatus={params.status}
          activeSort={params.sort}
        />
      </div>

      {/* Plant grid or empty state */}
      {plants.length === 0 ? (
        totalPlantCount === 0 && !hasActiveFilters ? (
          <EmptyState
            icon={Leaf}
            iconVariant="muted"
            heading="Your collection is empty"
            body="Add a plant to begin building your collection."
            action={<AddPlantDialog catalog={catalog} rooms={rooms} />}
          />
        ) : (
          // Context-aware empty state when filters yield no results
          <EmptyFilterState
            search={params.search}
            status={params.status}
            roomName={activeRoom?.name}
          />
        )
      ) : (
        <>
          <PlantGrid plants={plants} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/plants"
            searchParams={{
              room: params.room,
              search: params.search,
              status: params.status,
              sort: params.sort,
            }}
          />
        </>
      )}
    </div>
  );
}

/** Builds a /plants URL clearing the specified param keys while keeping others. */
function buildClearUrl(
  currentParams: Record<string, string | undefined>,
  clearKeys: string[]
): string {
  const p = new URLSearchParams();
  for (const [key, val] of Object.entries(currentParams)) {
    if (val && !clearKeys.includes(key)) {
      p.set(key, val);
    }
  }
  const qs = p.toString();
  return qs ? `/plants?${qs}` : "/plants";
}

function EmptyFilterState({
  search,
  status,
  roomName,
}: {
  search?: string;
  status?: string;
  roomName?: string;
}) {
  const allParams: Record<string, string | undefined> = {
    search,
    status,
    room: roomName, // Note: room param is the ID — we only use this for display logic
  };

  let heading = "No plants found";
  let body = "";
  let ctaLabel = "";
  let clearUrl = "/plants";

  if (status === "archived" && !search && !roomName) {
    heading = "No archived plants";
    body = "Plants you archive will appear here.";
  } else if (search && !status && !roomName) {
    body = `No plants match "${search}". Try a different name or spelling.`;
    ctaLabel = "Clear search";
    clearUrl = buildClearUrl(allParams, ["search"]);
  } else if (status && !search && !roomName) {
    const statusLabel =
      status === "due-today"
        ? "due today"
        : status === "overdue"
          ? "overdue"
          : status === "upcoming"
            ? "upcoming"
            : status;
    body = `No plants are ${statusLabel} right now.`;
    ctaLabel = "Show all plants";
    clearUrl = buildClearUrl(allParams, ["status"]);
  } else if (roomName && status) {
    const statusLabel =
      status === "due-today" ? "due today" : status;
    body = `No ${statusLabel} plants in ${roomName}.`;
    ctaLabel = "Clear filters";
    clearUrl = "/plants";
  } else {
    body = "No plants match your current filters.";
    ctaLabel = "Clear filters";
    clearUrl = "/plants";
  }

  return (
    <EmptyState
      icon={SearchIcon}
      iconVariant="muted"
      heading={heading}
      body={body || "Try a different search term or clear your filters."}
      action={ctaLabel ? (
        <Link href={clearUrl}>
          <Button variant="outline" size="sm">
            {ctaLabel}
          </Button>
        </Link>
      ) : undefined}
    />
  );
}
