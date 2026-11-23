update storage.buckets set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['application/json'])) where id = 'hc-facturas';
