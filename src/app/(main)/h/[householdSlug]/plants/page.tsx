import { auth } from "../../../../../../auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentHousehold } from "@/features/household/context";
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
  params,
  searchParams,
}: {
  params: Promise<{ householdSlug: string }>;
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

  const { householdSlug } = await params;
  const { household } = await getCurrentHousehold(householdSlug);

  // Timezone for status filter date boundaries (same pattern as dashboard/page.tsx)
  const cookieStore = await cookies();
  const userTz = cookieStore.get("user_tz")?.value ?? "UTC";
  const now = new Date();
  const localDateStr = now.toLocaleDateString("en-CA", { timeZone: userTz });
  const [year, month, day] = localDateStr.split("-").map(Number);
  const todayStart = new Date(Date.UTC(year, month - 1, day));
  const todayEnd = new Date(Date.UTC(year, month - 1, day + 1));

  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const [plantsResult, catalog, rooms, totalPlantCount] = await Promise.all([
    getPlants(household.id, {
      roomId: sp.room,
      search: sp.search,
      status: sp.status,
      sort: sp.sort,
      todayStart,
      todayEnd,
      page: currentPage,
    }),
    getCatalog(),
    getRoomsForSelect(household.id),
    db.plant.count({ where: { householdId: household.id, archivedAt: null } }),
  ]);

  // Redirect to page 1 if requested page is out of range
  if (currentPage > plantsResult.totalPages && plantsResult.totalPages > 0) {
    const redirectParams = new URLSearchParams();
    if (sp.room) redirectParams.set("room", sp.room);
    if (sp.search) redirectParams.set("search", sp.search);
    if (sp.status) redirectParams.set("status", sp.status);
    if (sp.sort) redirectParams.set("sort", sp.sort);
    const qs = redirectParams.toString();
    redirect(qs ? `/h/${householdSlug}/plants?${qs}` : `/h/${householdSlug}/plants`);
  }

  const { plants, totalPages, currentPage: page } = plantsResult;

  const hasActiveFilters = !!(sp.search || sp.status || sp.room);
  const activeRoom = sp.room
    ? rooms.find((r: { id: string; name: string }) => r.id === sp.room)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 tabIndex={-1} className="text-2xl font-semibold outline-none">Plants</h1>
        <AddPlantDialog catalog={catalog} rooms={rooms} householdId={household.id} />
      </div>

      {/* Search, filter, sort block */}
      <div className="space-y-2">
        <SearchBar defaultValue={sp.search} basePath={`/h/${householdSlug}/plants`} />
        <FilterChips
          rooms={rooms}
          activeRoomId={sp.room}
          activeStatus={sp.status}
          activeSort={sp.sort}
          basePath={`/h/${householdSlug}/plants`}
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
            action={<AddPlantDialog catalog={catalog} rooms={rooms} householdId={household.id} />}
          />
        ) : (
          // Context-aware empty state when filters yield no results
          <EmptyFilterState
            search={sp.search}
            status={sp.status}
            roomName={activeRoom?.name}
            householdSlug={householdSlug}
            currentParams={sp}
          />
        )
      ) : (
        <>
          <PlantGrid plants={plants} householdSlug={householdSlug} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath={`/h/${householdSlug}/plants`}
            searchParams={{
              room: sp.room,
              search: sp.search,
              status: sp.status,
              sort: sp.sort,
            }}
          />
        </>
      )}
    </div>
  );
}

/** Builds a /h/[householdSlug]/plants URL clearing the specified param keys while keeping others. */
function buildClearUrl(
  householdSlug: string,
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
  return qs ? `/h/${householdSlug}/plants?${qs}` : `/h/${householdSlug}/plants`;
}

function EmptyFilterState({
  search,
  status,
  roomName,
  householdSlug,
  currentParams,
}: {
  search?: string;
  status?: string;
  roomName?: string;
  householdSlug: string;
  currentParams: Record<string, string | undefined>;
}) {
  let heading = "No plants found";
  let body = "";
  let ctaLabel = "";
  let clearUrl = `/h/${householdSlug}/plants`;

  if (status === "archived" && !search && !roomName) {
    heading = "No archived plants";
    body = "Plants you archive will appear here.";
  } else if (search && !status && !roomName) {
    body = `No plants match "${search}". Try a different name or spelling.`;
    ctaLabel = "Clear search";
    clearUrl = buildClearUrl(householdSlug, currentParams, ["search"]);
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
    clearUrl = buildClearUrl(householdSlug, currentParams, ["status"]);
  } else if (roomName && status) {
    const statusLabel =
      status === "due-today" ? "due today" : status;
    body = `No ${statusLabel} plants in ${roomName}.`;
    ctaLabel = "Clear filters";
    clearUrl = `/h/${householdSlug}/plants`;
  } else {
    body = "No plants match your current filters.";
    ctaLabel = "Clear filters";
    clearUrl = `/h/${householdSlug}/plants`;
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
