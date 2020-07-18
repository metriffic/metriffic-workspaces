const colors = require('colors');

function user_str(username) 
{
    return username.bold.brightWhite;
}

function time_str(timestamp) 
{
    const dt = new Date(timestamp);
    return dt.toLocaleString().bold.brightWhite;
}

function error_str(msg) 
{
    const pmsg = (msg);
    return pmsg.bold;
}


module.exports.LOG_USER = user_str;
module.exports.LOG_TIME = time_str;
module.exports.ERROR = error_str;

