import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import {
  getUsersApi,
  getUserByIdApi,
  createPrincipalApi,
  createStaffApi,
  createStudentApi,
  updateUserApi,
  updateUserStatusApi,
  deleteUserApi,
} from "@/api/userService"
import { getSchoolsApi } from "@/api/schoolService"

/**
 * Deterministic Query Keys Factory
 */
export const userKeys = {
  all: ["users"],
  lists: () => [...userKeys.all, "list"],
  list: (filters) => [...userKeys.lists(), filters],
  details: () => [...userKeys.all, "detail"],
  detail: (id) => [...userKeys.details(), id],
}

export const schoolKeys = {
  all: ["schools"],
  list: () => [...schoolKeys.all, "list"],
}

/**
 * Hook to fetch paginated/filtered list of users
 */
export function useUsers(filters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => getUsersApi(filters),
    placeholderData: keepPreviousData,
  })
}

/**
 * Hook to fetch single user by ID
 */
export function useUser(userId) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => getUserByIdApi(userId),
    enabled: Boolean(userId),
  })
}

/**
 * Hook to fetch list of schools
 */
export function useSchools() {
  return useQuery({
    queryKey: schoolKeys.list(),
    queryFn: getSchoolsApi,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  })
}

/**
 * Hook to create user based on 3 roles:
 * 1: Principal
 * 2: Staff
 * 3: Student
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ role, ...data }) => {
      switch (Number(role)) {
        case 1:
          return createPrincipalApi(data)
        case 2:
          return createStaffApi(data)
        case 3:
          return createStudentApi(data)
        default:
          throw new Error(`Unsupported user role: ${role}`)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

/**
 * Hook to update user details
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, data }) => updateUserApi(userId, data),
    onSuccess: (updatedUser, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

/**
 * Hook to update user active status with Optimistic Updates
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, isActive }) => updateUserStatusApi(userId, isActive),
    onMutate: async ({ userId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.lists() })

      const previousQueries = queryClient.getQueriesData({ queryKey: userKeys.lists() })

      queryClient.setQueriesData({ queryKey: userKeys.lists() }, (old) => {
        if (!old || !old.items) return old
        return {
          ...old,
          items: old.items.map((user) =>
            user.id === userId ? { ...user, is_active: isActive } : user
          ),
        }
      })

      return { previousQueries }
    },
    onError: (err, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

/**
 * Hook to soft delete user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId) => deleteUserApi(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}
