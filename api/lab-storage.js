import { createClient } from '@supabase/supabase-js';

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'method_not_allowed' });

  const url = process.env.GARDEN_LABS_SUPABASE_URL;
  const serviceKey = process.env.GARDEN_LABS_SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.GARDEN_LABS_OWNER_ID;
  if (!url || !serviceKey || !ownerId) return json(res, 503, { error: 'storage_not_configured' });

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const kind = String(req.query?.kind || '');

  try {
    if (kind === 'seeds') {
      if (req.method === 'GET') {
        const { data, error } = await db.rpc('garden_lab_service_get_seed_storage', { p_owner: ownerId });
        if (error) throw error;
        return json(res, 200, data || { seedUserState: {}, customSeeds: [], importCompleted: false });
      }
      const { data, error } = await db.rpc('garden_lab_service_seed_operation', { p_owner: ownerId, p_payload: req.body || {} });
      if (error) throw error;
      return json(res, 200, data || { ok: true });
    }

    if (kind === 'machines') {
      if (req.method === 'GET') {
        const { data, error } = await db.rpc('garden_lab_service_get_machine_storage', { p_owner: ownerId });
        if (error) throw error;
        return json(res, 200, data || { instances: [] });
      }
      const instance = req.body?.instance;
      if (req.body?.operation !== 'save' || !instance?.id) return json(res, 400, { error: 'invalid_machine_operation' });
      const { data, error } = await db.rpc('garden_lab_service_save_machine', { p_owner: ownerId, p_instance: instance });
      if (error) throw error;
      return json(res, 200, data || { ok: true, instance });
    }

    return json(res, 400, { error: 'invalid_kind' });
  } catch (error) {
    console.error('Garden Labs storage gateway error', error);
    return json(res, 500, { error: 'storage_error' });
  }
}
