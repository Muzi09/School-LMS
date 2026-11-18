import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/context/authState"
import {
  getStudentsListApi,
  getStudentByIdApi,
  createStudentApi,
  updateStudentApi,
  updateStudentStatusApi,
  deleteStudentApi,
} from "@/api/studentService"

export const studentKeys = {
  all: ["students"],
  lists: () => [...studentKeys.all, "list"],
  list: (scope, filters) => [...studentKeys.lists(), scope, filters],
  details: () => [...studentKeys.all, "detail"],
  detail: (id) => [...studentKeys.details(), id],
}

export function useStudentsList(filters = {}) {
  const { user } = useAuth()
  const scope = user?.school_id ? `${user.school_id}:${user.id}` : null
  return useQuery({
    queryKey: studentKeys.list(scope, filters),
    queryFn: () => getStudentsListApi(filters),
    enabled: Boolean(scope),
    placeholderData: (previous, query) => query?.queryKey[2] === scope ? previous : undefined,
  })
}

export function useStudentMember(studentId) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...studentKeys.detail(studentId), user?.school_id, user?.id],
    queryFn: () => getStudentByIdApi(studentId),
    enabled: Boolean(studentId && user?.school_id),
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createStudentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (/** @type {{ studentId: string, data: import("@/api/studentService").StudentUpdate }} */ { studentId, data }) => updateStudentApi(studentId, data),
    onSuccess: (updated, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) })
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}

export function useUpdateStudentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (/** @type {{ studentId: string, isActive: boolean }} */ { studentId, isActive }) => updateStudentStatusApi(studentId, isActive),
    onMutate: async ({ studentId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: studentKeys.lists() })
      const previousQueries = queryClient.getQueriesData({ queryKey: studentKeys.lists() })

      queryClient.setQueriesData({ queryKey: studentKeys.lists() }, (old) => {
        if (!old || !old.items) return old
        return {
          ...old,
          items: old.items.map((s) => (s.id === studentId ? { ...s, is_active: isActive } : s)),
        }
      })

      return { previousQueries }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.previousQueries) {
        ctx.previousQueries.forEach(([key, data]) => {
          if (queryClient.getQueryState(key)) queryClient.setQueryData(key, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}

export function useDeleteStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteStudentApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}
