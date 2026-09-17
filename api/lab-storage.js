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
        const [{ data: rows, error: e1 }, { data: custom, error: e2 }] = await Promise.all([
          db.schema('garden_lab').from('seed_personal_state').select('*').eq('owner_id', ownerId),
          db.schema('garden_lab').from('custom_seeds').select('*').eq('owner_id', ownerId).order('created_at'),
        ]);
        if (e1 || e2) throw e1 || e2;
        const seedUserState = Object.fromEntries((rows || []).map(r => [r.seed_key, {
          packageStatus: r.package_status, quantityLevel: r.quantity_level, storageLocation: r.storage_location,
          purchaseDate: r.purchase_date, purchaseYear: r.legacy_purchase_year, legacyPurchaseYear: r.legacy_purchase_year,
          lastGerminationTestAt: r.germination_test_date, lastGerminationResultPct: r.germination_result_pct,
          notes: r.notes, archived: r.archived,
        }]));
        const customSeeds = (custom || []).map(r => ({ id:r.seed_key, packetName:r.packet_name, brand:r.brand, aliases:[], createdInLab:true }));
        return json(res, 200, { seedUserState, customSeeds, importCompleted: (rows?.length || 0) + (custom?.length || 0) > 0 });
      }

      const body = req.body || {};
      if (body.operation === 'delete-custom') {
        await db.schema('garden_lab').from('seed_personal_state').delete().eq('owner_id', ownerId).eq('seed_key', body.seedKey);
        const { error } = await db.schema('garden_lab').from('custom_seeds').delete().eq('owner_id', ownerId).eq('seed_key', body.seedKey);
        if (error) throw error;
      } else {
        const states = body.operation === 'import' ? (body.seedUserState || {}) : { [body.seedKey]: body.state };
        const rows = Object.entries(states).filter(([,v]) => v && typeof v === 'object').map(([key,v]) => ({
          owner_id: ownerId, seed_key:key, package_status:['opened','unopened','unknown'].includes(v.packageStatus)?v.packageStatus:'unknown',
          quantity_level:['full','high','medium','low','almost_empty','unknown'].includes(v.quantityLevel)?v.quantityLevel:'unknown',
          storage_location:v.storageLocation||null, purchase_date:/^\d{4}-\d{2}-\d{2}$/.test(v.purchaseDate||'')?v.purchaseDate:null,
          legacy_purchase_year:v.legacyPurchaseYear||v.purchaseYear||null, germination_test_date:/^\d{4}-\d{2}-\d{2}$/.test(v.lastGerminationTestAt||'')?v.lastGerminationTestAt:null,
          germination_result_pct:Number.isInteger(Number(v.lastGerminationResultPct)) && Number(v.lastGerminationResultPct)>=0 && Number(v.lastGerminationResultPct)<=100 ? Number(v.lastGerminationResultPct):null,
          notes:v.notes||null, archived:Boolean(v.archived), updated_at:new Date().toISOString(),
        }));
        if (rows.length) { const { error } = await db.schema('garden_lab').from('seed_personal_state').upsert(rows, { onConflict:'owner_id,seed_key' }); if (error) throw error; }
        const custom = body.operation === 'import' ? (body.customSeeds || []) : (body.customSeed ? [body.customSeed] : []);
        const crows = custom.filter(s=>s?.id && s?.packetName).map(s=>({owner_id:ownerId,seed_key:s.id,packet_name:String(s.packetName).trim(),brand:s.brand||null,updated_at:new Date().toISOString()}));
        if(crows.length){ const {error}=await db.schema('garden_lab').from('custom_seeds').upsert(crows,{onConflict:'owner_id,seed_key'}); if(error) throw error; }
      }
      return json(res, 200, { ok:true });
    }

    if (kind === 'machines') {
      if (req.method === 'GET') {
        const {data,error}=await db.schema('garden_lab').from('machine_state').select('state').eq('owner_id',ownerId).order('machine_key');
        if(error) throw error; return json(res,200,{instances:(data||[]).map(r=>r.state)});
      }
      const instance=req.body?.instance; if(req.body?.operation!=='save'||!instance?.id) return json(res,400,{error:'invalid_machine_operation'});
      const {error}=await db.schema('garden_lab').from('machine_state').upsert({owner_id:ownerId,machine_key:instance.id,state:instance,updated_at:new Date().toISOString()},{onConflict:'owner_id,machine_key'});
      if(error) throw error; return json(res,200,{ok:true,instance});
    }

    return json(res, 400, { error:'invalid_kind' });
  } catch (error) {
    console.error('Garden Labs storage gateway error', error);
    return json(res, 500, { error:'storage_error' });
  }
}
