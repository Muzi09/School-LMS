const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (import.meta.env.VITE_BACKEND_URL) {
    const backend = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, "")
    return `${backend}/api/v1`
  }
  return "/api/v1"
}

const API_BASE = 'https://school-lms-d12h.onrender.com/api/v1/'

export async function fetchUsers({ schoolId, role, isActive, search, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (schoolId) params.append("school_id", schoolId);
  if (role !== undefined && role !== null && role !== "") params.append("role", role);
  if (isActive !== undefined && isActive !== null && isActive !== "") params.append("is_active", isActive);
  if (search) params.append("search", search);
  params.append("page", page);
  params.append("page_size", pageSize);

  const res = await fetch(`${API_BASE}/users?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to fetch users");
  }
  return res.json();
}

export async function fetchUserById(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to fetch user details");
  }
  return res.json();
}

export async function createSuperAdmin(data) {
  return createAdmin(data);
}

export async function createAdmin(data) {
  const res = await fetch(`${API_BASE}/users/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to create Admin");
  }
  return res.json();
}

export async function createTeacher(data) {
  const res = await fetch(`${API_BASE}/users/teacher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to create Teacher");
  }
  return res.json();
}

export async function createStudent(data) {
  const res = await fetch(`${API_BASE}/users/student`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to create Student");
  }
  return res.json();
}

export async function updateUser(userId, data) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to update user");
  }
  return res.json();
}

export async function updateUserStatus(userId, isActive) {
  const res = await fetch(`${API_BASE}/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to update user status");
  }
  return res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to delete user");
  }
  return res.json();
}

export async function fetchSchools() {
  const res = await fetch(`${API_BASE}/schools`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || "Failed to fetch schools");
  }
  return res.json();
}
