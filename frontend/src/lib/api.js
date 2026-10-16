const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Fetch health status from backend API
 * @returns {Promise<{success: boolean, message: string, environment?: string, database?: string, timestamp?: string}>}
 */
export async function getBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
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
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(userData),
    });

    const result = await res.json().catch(() => ({}));

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
 * Authenticate user credentials and receive HttpOnly cookie
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ success: boolean, status: number, message: string, data?: object }>}
 */
export async function loginUserApi(credentials) {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const result = await res.json().catch(() => ({}));

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
 * Fetch current authenticated user profile using HttpOnly cookie
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getCurrentUserApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
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
 * Logout current user and clear HttpOnly cookie
 * @returns {Promise<{ success: boolean, status: number, message: string }>}
 */
export async function logoutUserApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    const result = await res.json().catch(() => ({}));

    return {
      success: res.ok,
      status: res.status,
      message: result.message || 'Logged out successfully',
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
 * Fetch the authenticated user's matrimonial profile
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getMyProfileApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/profiles/me`, {
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
    const res = await fetch(`${API_BASE_URL}/profiles/me`, {
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
    const res = await fetch(`${API_BASE_URL}/profiles/me`, {
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

    const res = await fetch(`${API_BASE_URL}/profiles/me/photo`, {
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
 * Verify administrator session using HttpOnly cookie
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string }>}
 */
export async function getAdminMeApi() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/me`, {
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
 * Fetch paginated user listing for administrators
 * @param {{ page?: number, limit?: number, search?: string }} params
 * @returns {Promise<{ success: boolean, status: number, data?: Array, pagination?: object, message?: string }>}
 */
export async function getAdminUsersApi({ page = 1, limit = 10, search = '' } = {}) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const res = await fetch(`${API_BASE_URL}/admin/users?${params.toString()}`, {
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
 * Fetch paginated matrimonial profile listing for administrators
 * @param {{ page?: number, limit?: number, search?: string }} params
 * @returns {Promise<{ success: boolean, status: number, data?: Array, pagination?: object, message?: string }>}
 */
export async function getAdminProfilesApi({ page = 1, limit = 10, search = '' } = {}) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const res = await fetch(`${API_BASE_URL}/admin/profiles?${params.toString()}`, {
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
    const res = await fetch(`${API_BASE_URL}/admin/profiles/broker`, {
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
    const res = await fetch(`${API_BASE_URL}/admin/profiles/${profileId}/approval`, {
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

    const res = await fetch(`${API_BASE_URL}/admin/profiles/${profileId}/photo`, {
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
 * Send login invitation email to an approved broker candidate (Admin only)
 * @param {string} profileId
 * @param {string} [email]
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string, warning?: boolean }>}
 */
export async function inviteBrokerCandidateApi(profileId, email) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/profiles/${profileId}/invite`, {
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
 * @param {string} profileId
 * @returns {Promise<{ success: boolean, status: number, data?: object, message?: string, warning?: boolean }>}
 */
export async function reinviteBrokerCandidateApi(profileId) {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/profiles/${profileId}/reinvite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
    const res = await fetch(`${API_BASE_URL}/auth/setup-password/verify?token=${encodeURIComponent(token)}`, {
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
    const res = await fetch(`${API_BASE_URL}/auth/setup-password`, {
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

    const res = await fetch(`${API_BASE_URL}/members?${params.toString()}`, {
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
    const res = await fetch(`${API_BASE_URL}/members/credits`, {
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
    const res = await fetch(`${API_BASE_URL}/members/${encodeURIComponent(profileId)}`, {
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
    const res = await fetch(`${API_BASE_URL}/subscriptions/create-order`, {
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
    const res = await fetch(`${API_BASE_URL}/subscriptions/verify-payment`, {
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
    const res = await fetch(`${API_BASE_URL}/subscriptions/me`, {
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
