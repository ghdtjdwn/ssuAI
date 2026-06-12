"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelWait,
  confirmReservation,
  getCurrentWait,
  prepareReservation,
  registerWait,
  type LibraryReservationPrepareRequest,
  type LibraryWaitRequest,
} from "@/lib/api/library";
import { ApiError } from "@/lib/api/types";

function isNonRetryableWaitError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.httpStatus === 404 ||
      error.httpStatus === 401 ||
      error.code === "LIBRARY_SESSION_REQUIRED")
  );
}

export function usePrepareReservation() {
  return useMutation({
    mutationFn: (req: LibraryReservationPrepareRequest) => prepareReservation(req),
  });
}

export function useConfirmReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => confirmReservation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library", "seats"] });
      void queryClient.invalidateQueries({ queryKey: ["library", "wait"] });
    },
  });
}

export function useCurrentWait() {
  return useQuery({
    queryKey: ["library", "wait"],
    queryFn: () => getCurrentWait(),
    staleTime: 10_000,
    retry: (failureCount, error) => {
      if (isNonRetryableWaitError(error)) return false;
      return failureCount < 2;
    },
  });
}

export function useRegisterWait() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: LibraryWaitRequest) => registerWait(req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library", "wait"] });
    },
  });
}

export function useCancelWait() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelWait(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library", "wait"] });
    },
  });
}
