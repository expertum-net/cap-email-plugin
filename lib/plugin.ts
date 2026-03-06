import cds from '@sap/cds'

const LOG = cds.log('email-plugin')

export function registerEmailHandlers() {
  LOG.info('Registering email handlers...')
  // TODO: Iterate ApplicationService entities and attach after handlers for @email annotated entities
}
