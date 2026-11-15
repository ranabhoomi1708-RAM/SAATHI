// public/js/api.js
// API client for Saathi. Frontend api helper takes paths without the /api prefix.

async function request(path, options = {}) {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : '/' + path}`;
  const headers = { ...(options.headers || {}) };

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    body,
    credentials: options.credentials || 'same-origin'
  });

  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = (data && data.error) ? data.error : `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get(path, options = {}) {
    return request(path, { ...options, method: 'GET' });
  },
  post(path, body, options = {}) {
    return request(path, { ...options, method: 'POST', body });
  },
  patch(path, body, options = {}) {
    return request(path, { ...options, method: 'PATCH', body });
  },
  delete(path, options = {}) {
    return request(path, { ...options, method: 'DELETE' });
  }
};

export default api;
