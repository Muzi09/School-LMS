import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import {
  getStaffListApi,
  getStaffByIdApi,
  createStaffApi,
  updateStaffApi,
  updateStaffStatusApi,
  deleteStaffApi,
} from "@/api/staffService"

export const staffKeys = {
  all: ["staff"],
  lists: () => [...staffKeys.all, "list"],
  list: (filters) => [...staffKeys.lists(), filters],
  details: () => [...staffKeys.all, "detail"],
  detail: (id) => [...staffKeys.details(), id],
}

export function useStaffList(filters = {}) {
  return useQuery({
    queryKey: staffKeys.list(filters),
    queryFn: () => getStaffListApi(filters),
    placeholderData: keepPreviousData,
  })
}

export function useStaffMember(staffId) {
  return useQuery({
    queryKey: staffKeys.detail(staffId),
    queryFn: () => getStaffByIdApi(staffId),
    enabled: Boolean(staffId),
  })
}

export function useCreateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => createStaffApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() })
    },
  })
}

export function useUpdateStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ staffId, data }) => updateStaffApi(staffId, data),
    onSuccess: (updated, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.detail(staffId) })
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() })
    },
  })
}

export function useUpdateStaffStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ staffId, isActive }) => updateStaffStatusApi(staffId, isActive),
    onMutate: async ({ staffId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: staffKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: staffKeys.lists() })

      queryClient.setQueriesData({ queryKey: staffKeys.lists() }, (old) => {
        if (!old || !old.items) return old
        return {
          ...old,
          items: old.items.map((s) => (s.id === staffId ? { ...s, is_active: isActive } : s)),
        }
      })

      return { previousQueries }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previousQueries) {
        ctx.previousQueries.forEach(([k, d]) => queryClient.setQueryData(k, d))
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() })
    },
  })
}

export function useDeleteStaff() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (staffId) => deleteStaffApi(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.lists() })
    },
  })
}
