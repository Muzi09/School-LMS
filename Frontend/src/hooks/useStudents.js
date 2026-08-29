import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
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
  list: (filters) => [...studentKeys.lists(), filters],
  details: () => [...studentKeys.all, "detail"],
  detail: (id) => [...studentKeys.details(), id],
}

export function useStudentsList(filters = {}) {
  return useQuery({
    queryKey: studentKeys.list(filters),
    queryFn: () => getStudentsListApi(filters),
    placeholderData: keepPreviousData,
  })
}

export function useStudentMember(studentId) {
  return useQuery({
    queryKey: studentKeys.detail(studentId),
    queryFn: () => getStudentByIdApi(studentId),
    enabled: Boolean(studentId),
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data) => createStudentApi(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ studentId, data }) => updateStudentApi(studentId, data),
    onSuccess: (updated, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(studentId) })
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}

export function useUpdateStudentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ studentId, isActive }) => updateStudentStatusApi(studentId, isActive),
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
        ctx.previousQueries.forEach(([k, d]) => queryClient.setQueryData(k, d))
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
    mutationFn: (studentId) => deleteStudentApi(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentKeys.lists() })
    },
  })
}
