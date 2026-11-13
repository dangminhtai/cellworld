export function verifyTargets(config,page,worker,expectedUrl,{record=false}={}){
  if(config.backendUrl!==expectedUrl)throw Error(`backendUrl must be ${expectedUrl}`);
  if(page && page.name!=='cellworld')throw Error('Unexpected Pages project');
  if(worker && worker.id!=='cellworld-backend')throw Error('Unexpected Worker');
  if(page && (!page.id || (config.pagesId && page.id!==config.pagesId) || (!config.pagesId&&!record)))throw Error('Existing cellworld Pages project is not the recorded project; refusing overwrite');
  if(worker && (!worker.tag || (config.backendTag && worker.tag!==config.backendTag) || (!config.backendTag&&!record)))throw Error('Existing cellworld-backend Worker is not the recorded Worker; refusing overwrite');
  if(!page&&config.pagesId)throw Error('Recorded Pages project disappeared; refusing recreation');
  if(!worker&&config.backendTag)throw Error('Recorded Worker disappeared; refusing recreation');
}
