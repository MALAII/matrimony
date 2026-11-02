const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';

/**
 * Token management helpers for resilient cross-origin authentication
 */
export function getStoredToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('matrimony_token') || '';
  }
  return '';
}

export function setStoredToken(token) {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('matrimony_token', token);
    } else {
      localStorage.removeItem('matrimony_token');
    }
  }
}

/**
 * Robust fetch wrapper that guarantees Authorization: Bearer token is attached
 * to all cross-origin requests even when third-party cookies are blocked by browsers.
 */
const authFetch = (url, options = {}) => {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, {
    ...options,
    credentials: options.credentials || 'include',
    headers,
  });
};

/**
 * Fetch health status from backend API
 * @returns {Promise<{success: boolean, message: string, environment?: string, database?: string, timestamp?: string}>}
 */
export async function getBackendHealth() {
  try {
    const res = await authFetch(`${API_BASE_URL}/health`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to backend API',
    };
  }
}

/**
 * Register a new user account through backend REST API
 * @param {{ name: string, email: string, password: string }} userData
 * @returns {Promise<{ success: boolean, status: number, message: string, data?: object }>}
 */
export async function registerUserApi(userData) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const result = await res.json().catch(() => ({}));
    if (result && result.data && result.data.token) {
      setStoredToken(result.data.token);
    }

    return {
      success: res.ok,
      status: res.status,
      message: result.message || (res.ok ? 'User registered successfully' : 'Registration failed'),
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection or try again later.',
    };
  }
}

/**
 * Authenticate user credentials and receive HttpOnly cookie + fallback bearer token
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ success: boolean, status: number, message: string, data?: object }>}
 */
export async function loginUserApi(credentials) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    const result = await res.json().catch(() => ({}));
    if (result && result.data && result.data.token) {
      setStoredToken(result.data.token);
    }

    return {
      success: res.ok,
      status: res.status,
      message: result.message || (res.ok ? 'Login successful' : 'Login failed'),
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection or try again later.',
    };
  }
}

/**
 * Fetch current authenticated user profile using HttpOnly cookie or Bearer token
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getCurrentUserApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Logout current user and clear HttpOnly cookie and Bearer token
 * @returns {Promise<{ success: boolean, status: number, message: string }>}
 */
export async function logoutUserApi() {
  try {
    setStoredToken(null);
    const res = await authFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      message: result.message || 'Logged out successfully',
    };
  } catch (error) {
    setStoredToken(null);
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Fetch the authenticated user's matrimonial profile
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getMyProfileApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Create the authenticated user's matrimonial profile
 * @param {object} profileData
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function createProfileApi(profileData) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Profile created successfully' : 'Failed to create profile'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Update the authenticated user's existing matrimonial profile
 * @param {object} profileData
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function updateProfileApi(profileData) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Profile updated successfully' : 'Failed to update profile'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Upload profile photograph using multipart/form-data
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function uploadProfilePhotoApi(file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/profiles/me/photo`, {
      method: 'POST',
      credentials: 'include',
      // Note: Do NOT set Content-Type header so fetch creates the multipart boundary
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo uploaded successfully' : 'Upload failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch member's own gallery photos (up to 3 photos)
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getMyPhotosApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me/photos`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photos loaded' : 'Failed to fetch photos'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Upload an additional photo for member's profile (enforces max 3)
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function addMyPhotoApi(file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/profiles/me/photos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo uploaded successfully' : 'Photo upload failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Replace an existing member photo
 * @param {string} photoId
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function replaceMyPhotoApi(photoId, file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/profiles/me/photos/${photoId}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo replaced successfully' : 'Photo replacement failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Delete a member photo
 * @param {string} photoId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function deleteMyPhotoApi(photoId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo deleted successfully' : 'Photo deletion failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Designate a specific member photo as primary
 * @param {string} photoId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function setMyPrimaryPhotoApi(photoId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me/photos/${photoId}/primary`, {
      method: 'PATCH',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Primary photo set' : 'Failed to update primary photo'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Verify administrator session using HttpOnly cookie
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getAdminMeApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Fetch paginated user listing for administrators with filter support
 * @param {{ page?: number, limit?: number, search?: string, status?: string, role?: string, registrationSource?: string }} params
 * @returns {Promise<{ success: boolean, status: number, data?: Array, pagination?: object, message?: string }>}
 */
export async function getAdminUsersApi({
  page = 1,
  limit = 10,
  search = '',
  status = '',
  role = '',
  registrationSource = '',
} = {}) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    if (status && status.trim()) {
      params.append('status', status.trim());
    }
    if (role && role.trim()) {
      params.append('role', role.trim());
    }
    if (registrationSource && registrationSource.trim()) {
      params.append('registrationSource', registrationSource.trim());
    }

    const res = await authFetch(`${API_BASE_URL}/admin/users?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || [],
      pagination: result.pagination || { page: 1, limit: 10, totalRecords: 0, totalPages: 1 },
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: [],
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Returns authenticated URL for exporting user accounts CSV
 * @param {{ search?: string, status?: string, role?: string, registrationSource?: string }} filters
 * @returns {string}
 */
export function getAdminUsersExportUrl({ search = '', status = '', role = '', registrationSource = '' } = {}) {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (status && status.trim()) params.append('status', status.trim());
  if (role && role.trim()) params.append('role', role.trim());
  if (registrationSource && registrationSource.trim()) params.append('registrationSource', registrationSource.trim());
  const qs = params.toString();
  return `${API_BASE_URL}/admin/users/export${qs ? `?${qs}` : ''}`;
}

/**
 * Downloads user accounts CSV export with authenticated session
 * @param {{ search?: string, status?: string, role?: string, registrationSource?: string }} filters
 * @returns {Promise<{ success: boolean, status?: number, blob?: Blob, filename?: string, message?: string }>}
 */
export async function downloadAdminUsersCsvApi(filters = {}) {
  try {
    const url = getAdminUsersExportUrl(filters);
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        message: err.message || 'Failed to download user accounts CSV export.',
      };
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    return {
      success: true,
      status: res.status,
      blob,
      filename,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network connection error while downloading user records.',
    };
  }
}

/**
 * Fetch paginated matrimonial profile listing for administrators
 * @param {{ page?: number, limit?: number, search?: string }} params
 * @returns {Promise<{ success: boolean, status: number, data?: Array, pagination?: object, message?: string }>}
 */
export async function getAdminProfilesApi({ page = 1, limit = 10, search = '', approvalStatus = '', profileStatus = '', source = '', gender = '' } = {}) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    if (approvalStatus) params.append('approvalStatus', approvalStatus);
    if (profileStatus) params.append('profileStatus', profileStatus);
    if (source) params.append('source', source);
    if (gender) params.append('gender', gender);

    const res = await authFetch(`${API_BASE_URL}/admin/profiles?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || [],
      pagination: result.pagination || { page: 1, limit: 10, totalRecords: 0, totalPages: 1 },
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: [],
      message: 'Unable to connect to the server.',
    };
  }
}

/**
 * Create an unlinked broker-sourced matrimonial profile (Admin only)
 * @param {object} brokerProfileData
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function createBrokerProfileApi(brokerProfileData) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/broker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(brokerProfileData),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Broker profile created successfully' : 'Failed to create broker profile'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Approve or reject a broker-sourced matrimonial profile (Admin only)
 * @param {string} profileId
 * @param {'approved' | 'rejected'} approvalStatus
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function updateProfileApprovalApi(profileId, approvalStatus) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/approval`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ approvalStatus }),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? `Profile status updated to ${approvalStatus}` : 'Failed to update approval status'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Upload photograph for a broker matrimonial profile (Admin only)
 * @param {string} profileId
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function uploadAdminBrokerPhotoApi(profileId, file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Broker profile photo uploaded successfully' : 'Photo upload failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch candidate photo gallery (up to 3 photos)
 * @param {string} profileId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getAdminCandidatePhotosApi(profileId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photos`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photos loaded' : 'Failed to fetch photos'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Upload an additional candidate photo (enforces max 3)
 * @param {string} profileId
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function addAdminCandidatePhotoApi(profileId, file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo uploaded successfully' : 'Photo upload failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Replace an existing candidate photo
 * @param {string} profileId
 * @param {string} photoId
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function replaceAdminCandidatePhotoApi(profileId, photoId, file) {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photos/${photoId}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo replaced successfully' : 'Photo replacement failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Delete a candidate photo
 * @param {string} profileId
 * @param {string} photoId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function deleteAdminCandidatePhotoApi(profileId, photoId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Photo deleted successfully' : 'Photo deletion failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Designate a specific candidate photo as the primary photo
 * @param {string} profileId
 * @param {string} photoId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function setAdminCandidatePrimaryPhotoApi(profileId, photoId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/photos/${photoId}/primary`, {
      method: 'PATCH',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Primary photo set' : 'Failed to update primary photo'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Validate an uploaded candidate Excel file for bulk import (Dry-Run)
 * @param {File} file
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function validateCandidateImportApi(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await authFetch(`${API_BASE_URL}/admin/imports/candidates/validate`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Validation complete' : 'Validation failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Execute chunked database commit of pre-validated candidates
 * @param {string} batchId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function commitCandidateImportApi(batchId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/imports/candidates/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ batchId }),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Import completed' : 'Import failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Returns URL for downloading starter Excel template
 */
export function getCandidateImportTemplateUrl() {
  return `${API_BASE_URL}/admin/imports/candidates/template`;
}

/**
 * Returns URL for downloading batch CSV error report
 */
export function getCandidateImportErrorsCsvUrl(batchId) {
  return `${API_BASE_URL}/admin/imports/candidates/${batchId}/errors/csv`;
}

/**
 * Send login invitation email to an approved broker candidate (Admin only)
 * @param {string} profileId
 * @param {string} [email]
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string, warning?: boolean }>}
 */
export async function inviteBrokerCandidateApi(profileId, email) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(email ? { email } : {}),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      warning: Boolean(result.warning),
      message: result.message || (res.ok ? 'Invitation sent successfully' : 'Failed to send invitation'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Resend login invitation email to an invited broker candidate (Admin only)
 * Optionally accepts a corrected email address to update the recipient.
 * @param {string} profileId
 * @param {string} [email]
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string, warning?: boolean }>}
 */
export async function reinviteBrokerCandidateApi(profileId, email) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/reinvite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(email ? { email: email.trim() } : {}),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      warning: Boolean(result.warning),
      message: result.message || (res.ok ? 'Invitation resent successfully' : 'Failed to resend invitation'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Verify setup password invitation token (Public)
 * @param {string} token
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function verifySetupTokenApi(token) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/setup-password/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Token verified' : 'Invalid or expired token'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Submit chosen password with token to activate candidate account (Public)
 * @param {{ token: string, password: string }} payload
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function setupPasswordApi(payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/setup-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Password configured successfully' : 'Failed to configure password'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Request password reset email (Public)
 * @param {string} email
 * @returns {Promise<{ success: boolean, status: number, message?: string }>}
 */
export async function forgotPasswordApi(email) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      message: result.message || (res.ok ? 'Reset request received.' : 'Unable to process reset request.'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Verify password reset token validity without consuming (Public)
 * @param {string} token
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function verifyResetTokenApi(token) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/reset-password/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data,
      message: result.message || (res.ok ? 'Token verified' : 'Invalid or expired reset token'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Submit new password with reset token to update account credentials (Public)
 * @param {{ token: string, password: string }} payload
 * @returns {Promise<{ success: boolean, status: number, message?: string }>}
 */
export async function resetPasswordApi(payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      message: result.message || (res.ok ? 'Password reset successfully' : 'Failed to reset password'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch paginated eligible matrimonial profiles for the authenticated member directory
 * @param {{ page?: number, limit?: number, search?: string }} params
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   code?: string,
 *   data?: Array,
 *   subscriptionAccess?: object,
 *   pagination?: object,
 *   message?: string
 * }>}
 */
export async function getMemberDirectoryApi({
  page = 1,
  limit = 12,
  search = '',
  gender = '',
  minAge = '',
  maxAge = '',
  maritalStatus = '',
  location = '',
  education = '',
  occupation = '',
  rasi = '',
  nakshatram = '',
  caste = '',
  subcaste = '',
  gothram = '',
  religion = '',
  minHeight = '',
  maxHeight = '',
  diet = '',
  dosham = '',
} = {}) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }
    if (gender && gender.trim()) {
      params.append('gender', gender.trim());
    }
    if (minAge !== '' && minAge !== null && minAge !== undefined) {
      params.append('minAge', String(minAge).trim());
    }
    if (maxAge !== '' && maxAge !== null && maxAge !== undefined) {
      params.append('maxAge', String(maxAge).trim());
    }
    if (minHeight !== '' && minHeight !== null && minHeight !== undefined) {
      params.append('minHeight', String(minHeight).trim());
    }
    if (maxHeight !== '' && maxHeight !== null && maxHeight !== undefined) {
      params.append('maxHeight', String(maxHeight).trim());
    }
    if (maritalStatus && maritalStatus.trim()) {
      params.append('maritalStatus', maritalStatus.trim());
    }
    if (location && location.trim()) {
      params.append('location', location.trim());
    }
    if (education && education.trim()) {
      params.append('education', education.trim());
    }
    if (occupation && occupation.trim()) {
      params.append('occupation', occupation.trim());
    }
    if (rasi && rasi.trim()) {
      params.append('rasi', rasi.trim());
    }
    if (nakshatram && nakshatram.trim()) {
      params.append('nakshatram', nakshatram.trim());
    }
    if (caste && caste.trim()) {
      params.append('caste', caste.trim());
    }
    if (subcaste && subcaste.trim()) {
      params.append('subcaste', subcaste.trim());
    }
    if (gothram && gothram.trim()) {
      params.append('gothram', gothram.trim());
    }
    if (religion && religion.trim()) {
      params.append('religion', religion.trim());
    }
    if (diet && diet.trim()) {
      params.append('diet', diet.trim());
    }
    if (dosham && dosham.trim()) {
      params.append('dosham', dosham.trim());
    }

    const res = await authFetch(`${API_BASE_URL}/members?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      code: result.code || result.subscriptionAccess?.code || null,
      data: Array.isArray(result.data) ? result.data : [],
      subscriptionAccess: result.subscriptionAccess || null,
      pagination: result.pagination || { page: 1, limit: 12, totalRecords: 0, totalPages: 1 },
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: null,
      data: [],
      subscriptionAccess: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch the signed-in member's current monthly contact-view credit balance
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getMemberCreditsApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/members/credits`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Unlock and view a candidate's phone number for a target profile (1 credit on first view, 0 on repeat view)
 * @param {string} profileId
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   code?: string,
 *   data?: {
 *     profileId: string,
 *     candidatePhone: string,
 *     alreadyUnlocked: boolean,
 *     creditsCharged: number,
 *     unlockedAt: string,
 *     credits: object
 *   },
 *   message?: string
 * }>}
 */
export async function unlockMemberContactApi(profileId) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/members/${encodeURIComponent(profileId)}/view-contact`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      }
    );

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      code: result.code || null,
      data: result.data || null,
      message:
        result.message ||
        (res.ok ? 'Contact number unlocked.' : 'Unable to unlock contact number.'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: null,
      data: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch full candidate details for an individual profile by profileId
 * @param {string} profileId
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   code?: string,
 *   data?: object,
 *   credits?: object,
 *   subscriptionAccess?: object,
 *   message?: string
 * }>}
 */
export async function getMemberCandidateDetailsApi(profileId) {
  try {
    const res = await authFetch(`${API_BASE_URL}/members/${encodeURIComponent(profileId)}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      code: result.code || result.subscriptionAccess?.code || null,
      data: result.data || null,
      credits: result.credits || result.subscriptionAccess?.credits || null,
      subscriptionAccess: result.subscriptionAccess || null,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      code: null,
      data: null,
      credits: null,
      subscriptionAccess: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Create a Razorpay order for purchasing a subscription plan
 * @param {string} planCode - 'THREE_MONTHS' | 'SIX_MONTHS'
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   data?: {
 *     orderId: string,
 *     amount: number,
 *     currency: string,
 *     planCode: string,
 *     planName: string,
 *     durationMonths: number,
 *     keyId: string
 *   },
 *   message?: string
 * }>}
 */
export async function createSubscriptionOrderApi(planCode) {
  try {
    const res = await authFetch(`${API_BASE_URL}/subscriptions/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ planCode }),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message:
        result.message ||
        (res.ok ? 'Subscription order created successfully.' : 'Unable to create subscription order.'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Verify Razorpay payment signature and activate subscription server-side
 * @param {{
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string
 * }} paymentData
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   data?: {
 *     subscriptionId: string,
 *     status: string,
 *     planCode: string,
 *     startDate: string,
 *     endDate: string
 *   },
 *   message?: string
 * }>}
 */
export async function verifySubscriptionPaymentApi(paymentData) {
  try {
    const res = await authFetch(`${API_BASE_URL}/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify(paymentData),
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message:
        result.message ||
        (res.ok ? 'Payment verified successfully.' : 'Payment verification failed.'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * Fetch the authenticated user's current subscription status and period
 * @returns {Promise<{
 *   success: boolean,
 *   status: number,
 *   data?: {
 *     hasSubscription: boolean,
 *     subscription?: {
 *       id: string,
 *       planCode: string,
 *       durationMonths: number,
 *       status: 'active' | 'grace_period' | 'expired' | 'pending' | 'cancelled',
 *       startDate: string,
 *       endDate: string,
 *       gracePeriodEndDate: string
 *     }
 *   },
 *   message?: string
 * }>}
 */
export async function getMySubscriptionApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/subscriptions/me`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message:
        result.message ||
        (res.ok ? 'Subscription fetched successfully.' : 'Unable to fetch subscription details.'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Unable to connect to the server. Please check your network connection.',
    };
  }
}

/**
 * =========================================================================
 * Jathagam / Astrological Particulars APIs (Prokerala Integration)
 * =========================================================================
 */

/**
 * Fetch pre-configured South Indian cities, Rasis, and Nakshatras
 */
export async function getSouthIndianCitiesApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/cities`, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await res.json().catch(() => ({}));
    const citiesList = Array.isArray(result.cities)
      ? result.cities
      : Array.isArray(result.data?.cities)
      ? result.data.cities
      : [];
    const rasisList = Array.isArray(result.rasis)
      ? result.rasis
      : Array.isArray(result.data?.rasis)
      ? result.data.rasis
      : [];
    const nakshatrasList = Array.isArray(result.nakshatras)
      ? result.nakshatras
      : Array.isArray(result.data?.nakshatras)
      ? result.data.nakshatras
      : [];

    return {
      success: res.ok,
      status: res.status,
      cities: citiesList,
      rasis: rasisList,
      nakshatras: nakshatrasList,
      data: result.data || { cities: citiesList, rasis: rasisList, nakshatras: nakshatrasList },
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      cities: [],
      rasis: [],
      nakshatras: [],
      data: { cities: [], rasis: [], nakshatras: [] },
      message: error?.message || 'Unable to load city dataset.',
    };
  }
}

/**
 * Generate and save Jathagam for the signed-in member
 */
export async function generateMyHoroscopeApi({
  dateOfBirth,
  timeOfBirth,
  placeOfBirth,
  birthCoordinates,
  language = 'en',
}) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me/horoscope/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        dateOfBirth,
        timeOfBirth,
        placeOfBirth,
        birthCoordinates,
        language,
      }),
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message || (res.ok ? 'Jathagam generated' : 'Failed to generate Jathagam'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Network error while generating Jathagam.',
    };
  }
}

/**
 * Manually update Jathagam particulars for signed-in member
 */
export async function updateMyHoroscopeApi(horoscopePayload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/profiles/me/horoscope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(horoscopePayload),
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message || (res.ok ? 'Horoscope updated' : 'Failed to update horoscope'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Network error while updating horoscope.',
    };
  }
}

/**
 * Generate a standalone South Indian Horoscope for any person (registered or unregistered)
 */
export async function generateStandaloneHoroscopeApi(payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/horoscopes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message || (res.ok ? 'Horoscope generated successfully' : 'Generation failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Network error while generating horoscope.',
    };
  }
}

/**
 * Generate and save Jathagam for an admin-managed candidate profile (backward compatibility)
 */
export async function generateAdminCandidateHoroscopeApi(profileId, payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${profileId}/horoscope/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message || (res.ok ? 'Candidate Jathagam generated' : 'Generation failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Network error while generating candidate Jathagam.',
    };
  }
}

/**
 * Preview Jathagam generation without saving (used in new candidate form)
 */
export async function previewAdminHoroscopeApi(payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/horoscope/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: result.data || null,
      message: result.message || (res.ok ? 'Jathagam preview generated' : 'Preview failed'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: null,
      message: 'Network error while previewing Jathagam.',
    };
  }
}

/**
 * Get all generated horoscopes for admin management and table listing
 */
export async function getAdminGeneratedHoroscopesApi() {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/horoscopes`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const result = await res.json().catch(() => ({}));
    return {
      success: res.ok,
      status: res.status,
      data: Array.isArray(result.data) ? result.data : [],
      message: result.message || (res.ok ? 'Horoscopes fetched' : 'Failed to fetch horoscopes'),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      data: [],
      message: 'Network error while fetching horoscopes.',
    };
  }
}

// Backward compatibility alias
export const getAdminBrokerHoroscopeCandidatesApi = getAdminGeneratedHoroscopesApi;

/**
 * Returns the URL for viewing or downloading the Horoscope PDF
 */
export function getAdminHoroscopePdfUrl(id, download = false) {
  return `${API_BASE_URL}/admin/horoscopes/${id}/pdf${download ? '?download=1' : ''}`;
}

async function adminProfileRequest(path, method, body) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/profiles/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, data: result.data, message: result.message };
  } catch (error) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}

export const updateAdminProfileApi = (profileId, payload) => adminProfileRequest(profileId, 'PATCH', payload);
export const updateAdminProfileStatusApi = (profileId, profileStatus) =>
  adminProfileRequest(`${profileId}/status`, 'PATCH', { profileStatus });
export const deleteAdminProfileApi = (profileId) => adminProfileRequest(profileId, 'DELETE');

async function adminGet(path, params = {}) {
  try {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) qs.append(k, String(v));
    });
    const res = await authFetch(`${API_BASE_URL}/admin/${path}${qs.toString() ? `?${qs}` : ''}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, ...r };
  } catch (e) {
    return { success: false, status: 0, data: [], message: 'Unable to connect to the server.' };
  }
}

export const getAdminPaymentsApi = (params) => adminGet('payments', params);
export const getAdminSubscriptionsApi = (params) => adminGet('subscriptions', params);
export const getAdminUserDetailApi = (id) => adminGet(`users/${id}`);
export const getAdminProfileDetailApi = (id) => adminGet(`profiles/${id}`);

export async function updateAdminSubscriptionApi(id, payload) {
  try {
    const res = await authFetch(`${API_BASE_URL}/admin/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, message: r.message, data: r.data };
  } catch (e) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}

export const getAdminStatsApi = (params = {}) => adminGet('stats', params);
export const getAdminUserStatsApi = () => adminGet('users/stats');

/**
 * Returns authenticated URL for exporting revenue payment records CSV
 * @param {{ range?: string, startDate?: string, endDate?: string, status?: string }} filters
 * @returns {string}
 */
export function getAdminRevenueExportUrl({ range = '30d', startDate = '', endDate = '', status = 'captured' } = {}) {
  const params = new URLSearchParams({ export: 'csv' });
  if (range) params.append('range', range);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (status) params.append('status', status);
  return `${API_BASE_URL}/admin/payments?${params.toString()}`;
}

/**
 * Downloads revenue payment records CSV report with authenticated session
 * @param {{ range?: string, startDate?: string, endDate?: string, status?: string }} filters
 * @returns {Promise<{ success: boolean, status?: number, blob?: Blob, filename?: string, message?: string }>}
 */
export async function downloadAdminRevenueCsvApi(filters = {}) {
  try {
    const url = getAdminRevenueExportUrl(filters);
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        message: err.message || 'Failed to download revenue CSV report.',
      };
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = `revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    return {
      success: true,
      status: res.status,
      blob,
      filename,
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: 'Network error downloading revenue report.',
    };
  }
}

// ============================================================================
// In-Website Notifications API (User & Admin Feeds)
// ============================================================================

/**
 * Fetch paginated in-website notifications.
 * @param {'user'|'admin'} feed
 * @param {{ page?: number, limit?: number }} params
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getNotificationsApi(feed = 'user', params = {}) {
  try {
    const basePath = feed === 'admin' ? `${API_BASE_URL}/admin/notifications` : `${API_BASE_URL}/notifications`;
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) qs.append(k, String(v));
    });
    const res = await fetch(`${basePath}${qs.toString() ? `?${qs.toString()}` : ''}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, ...r };
  } catch (e) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}

/**
 * Fetch fast unread notifications count.
 * @param {'user'|'admin'} feed
 * @returns {Promise<{ success: boolean, status: number, data?: { unreadCount: number }, message?: string }>}
 */
export async function getNotificationsUnreadCountApi(feed = 'user') {
  try {
    const basePath = feed === 'admin' ? `${API_BASE_URL}/admin/notifications/unread-count` : `${API_BASE_URL}/notifications/unread-count`;
    const res = await fetch(basePath, {
      credentials: 'include',
      cache: 'no-store',
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, ...r };
  } catch (e) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}

/**
 * Mark a single notification as read.
 * @param {'user'|'admin'} feed
 * @param {string} id
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function markNotificationReadApi(feed = 'user', id) {
  try {
    const basePath = feed === 'admin' ? `${API_BASE_URL}/admin/notifications/${id}/read` : `${API_BASE_URL}/notifications/${id}/read`;
    const res = await fetch(basePath, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, ...r };
  } catch (e) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}

/**
 * Mark all notifications as read.
 * @param {'user'|'admin'} feed
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function markAllNotificationsReadApi(feed = 'user') {
  try {
    const basePath = feed === 'admin' ? `${API_BASE_URL}/admin/notifications/mark-all-read` : `${API_BASE_URL}/notifications/mark-all-read`;
    const res = await fetch(basePath, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
    const r = await res.json().catch(() => ({}));
    return { success: res.ok, status: res.status, ...r };
  } catch (e) {
    return { success: false, status: 0, message: 'Unable to connect to the server.' };
  }
}
