
import { isSupabaseConfigured, supabaseServer } from './lib/supabase';

async function main() {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer();
    const { data, error } = await sb.from('platform_settings').select('*').eq('key', 'agent_minimum_version');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('No Supabase');
  }
}

main();
