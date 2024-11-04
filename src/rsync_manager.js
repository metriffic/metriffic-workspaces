const fs = require('fs');
const crypto = require('crypto');
const inspect = require('util').inspect;
const ssh2 = require('ssh2');
const { spawn, spawnSync, execSync } = require('child_process');

const config = require('./config')
const { LOG_USER, ERROR } = require('./logging')

class RSyncSessionManager 
{
    constructor() 
    {

        this.active_users = new Map();
        const rsync_manager = this;

        this.server = new ssh2.Server({
            hostKeys: [{
                key: fs.readFileSync(config.RSYNC_SERVER_HOST_KEY_FILE),
                passphrase: 'blabla',
            }],
          });

        this.server.on('connection', (client) => {
            console.log('[RSM] client connected.');
            var auth_client = undefined;

            const check_value = (input, allowed) => {
                const auto_reject = (input.length !== allowed.length);
                if (auto_reject) {
                      // Prevent leaking length information by always making a comparison with the
                      // same input when lengths don't match what we expect ...
                      allowed = input;
                }
                const is_match = crypto.timingSafeEqual(input, allowed);
                return (!auto_reject && is_match);
            }
           
            client.on('authentication', (ctx) => {
                const username = ctx.username;
                const record = rsync_manager.active_users.get(username);
                console.log(`[RSM] x1 ${ctx.username}, ${ctx.method},  ${record}`)
                if(record == undefined) {
                    return ctx.reject();
                }
                
                switch (ctx.method) {
                case 'publickey':
                    const allowed_pub_key = ssh2.utils.parseKey(record.public_key);
                    if (ctx.key.algo !== allowed_pub_key.type
                        || !check_value(ctx.key.data, allowed_pub_key.getPublicSSH())
                        || (ctx.signature && allowed_pub_key.verify(ctx.blob, ctx.signature, ctx.hashAlgo) !== true)) {
                        return ctx.reject();
                    }
                    auth_client = { 
                        username: username, 
                        workspace: record.workspace 
                    };
                    return ctx.accept();
                default:
                    return ctx.reject();
                }  

            }).on('error', function(err) {
                console.log(ERROR(`[RSM] ${err}`));
                if(auth_client) {
                    rsync_manager.active_users.delete(auth_client.username);
                }
            }).on('ready', function() {
                console.log(`[RSM] client ${LOG_USER(auth_client.username)} authenticated`);
            
                client.on('session', function(accept, reject) {
                    const session = accept();

                    session.on('exec', function(accept, reject, info) {           
                        const cmd = inspect(info.command); 
                        const stream = accept();                                   
                        var cmdsplit = cmd.split(' ');
                        cmdsplit = cmdsplit.slice(1,cmdsplit.length-1);
                        //cmdsplit.pop();
                        cmdsplit.push(auth_client.workspace);
                        const child = spawn('/usr/bin/rsync', cmdsplit);

                        child.stdout.pipe(stream);
                        stream.pipe(child.stdin);
                
                        child.on('close', (code) => {
                            console.log(`[RSM] child process exited with code ${code}`);
                            stream.exit(0);
                            stream.end();
                            client.end();
                        });            
                    });
                })

                .on('request', (accept, reject, name, info) => {
                    console.log(LOG_ERROR(`[RSM] error: request ${name}, ${info} is not supported`));
                })

            }).on('end', function() {
                if(auth_client) {
                    console.log(`[RSM] client ${LOG_USER(auth_client.username)} disconnected`);
                    rsync_manager.active_users.delete(auth_client.username);
                }
            });
        });

	this.server.listen(config.RSYNC_SERVER_PORT, function() {
            console.log('[RSM] listening on port ' + this.address().port);
        });
    }
    
    start_session(username, public_key, workspace)
    {
        this.active_users.set(username, {
                    public_key: public_key, 
                    workspace: workspace
                });   
    }

    end_session(username) 
    {
        this.active_users.delete(username);
        // tbd: drop the connection
    }
};

module.exports.rsync_manager = new RSyncSessionManager();
