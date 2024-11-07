const path = require('path');
const env = require('env-var');

module.exports = {
    GQL_ADDRESS: env.get('METRIFFIC_GQL_ADDRESS').required().asString(),
    GQL_ENDPOINT: 'workspace_manager',

    USERSPACE_ROOT: env.get('METRIFFIC_USERSPACE_NFS_ROOT').required().asString(),

    WORKSPACE_MANAGER_PRIVATE_KEY_FILE: env.get('METRIFFIC_WORKSPACE_MANAGER_PRIVATE_KEY_FILE').required().asString(),

    RSYNC_SERVER_HOST_KEY_FILE: env.get('METRIFFIC_RSYNC_SERVER_HOST_KEY_FILE').required().asString(),
    RSYNC_SERVER_PORT : 7000
}

