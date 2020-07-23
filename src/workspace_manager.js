const path = require('path');
const fs = require('fs');

const gql = require('graphql-tag');
const config = require('./config')
const metriffic_client = require('./metriffic_gql').metriffic_client

const { LOG_USER, ERROR } = require('./logging')
const { rsync_manager } = require('./rsync_manager');

class WorkspaceManager
{       
    constructor() 
    {
        this.start();
    }

    async start()
    {
        console.log('[W] starting service...');
        await this.subscribe_to_gql_updates();
    }

    on_user_added(data)
    {
        // TBD: can the directory name exist?
        // it shouldn't since the username is unique, but account recreation may potentially cause this...
        const user_folder = path.join(config.USERSPACE_ROOT + data.username);
        fs.mkdirSync(user_folder, { recursive: false });
        fs.chmodSync(user_folder, '0777');
       
        console.log(`[WM] created workspace for user ${LOG_USER(data.username)}`);
    }

    on_rsync_link_requested(data)
    {
        // note: username/password may be undefined
        rsync_manager.start_session(data.username, 
                                    data.password,
                                    path.join(config.USERSPACE_ROOT + data.username) + path.sep);
    }

    async subscribe_to_gql_updates()
    {
        const workspace_manager = this;

        // subscribe to user updates
        const subscribe_users = gql`
        subscription subsUser { 
            subsUser { mutation data {id, username }}
        }`;

        metriffic_client.gql.subscribe({
            query: subscribe_users,
        }).subscribe({
            next(ret) {
                const update = ret.data.subsUser;
                if(update.mutation === "ADDED") {
                    workspace_manager.on_user_added(update.data);
                } else
                if(update.mutation === "DELETED") {
                    //TBD: delete a user 
                }
            },
            error(err) {
                console.log(ERROR(`[WM] error: failed to subscribe: ${err}`));
            }
        });

        // subscribe to user updates
        const subscribe_rsync_requests = gql`
        subscription subsRSync { 
            subsRSync { username password }
        }`;

        metriffic_client.gql.subscribe({
            query: subscribe_rsync_requests,
        }).subscribe({
            next(ret) {
                const update = ret.data.subsRSync;
                workspace_manager.on_rsync_link_requested(update);
            },
            error(err) {
                console.log(ERROR(`[WM] error: failed to subscribe: ${err}`));
            }
        });
    }

};

   

module.exports.WorkspaceManager = WorkspaceManager;
