import { Skeleton } from "@/components/ui/skeleton";

interface WeeklyMealSkeletonProps {
  dayCount?: number;
}

export function WeeklyMealSkeleton({ dayCount = 7 }: WeeklyMealSkeletonProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        {Array.from({ length: dayCount }).map((_, index) => (
          <Skeleton key={`skeleton-day-${index}`} className="h-[76px] w-full rounded-[12px]" />
        ))}
      </div>
      <Skeleton className="h-36 w-full rounded-[12px]" />
    </div>
  );
}
