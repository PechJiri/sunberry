'use strict';

function createPairedDevice({ type, ipAddress, name, settings = {} }) {
    if (!type) throw new Error('type is required');
    if (!ipAddress) throw new Error('ipAddress is required');
    if (!name) throw new Error('name is required');

    return {
        name,
        data: {
            id: `${ipAddress}:${type}`
        },
        settings: {
            ip_address: ipAddress,
            update_interval: 10,
            enable_debug_logs: false,
            ...settings
        }
    };
}

module.exports = {
    createPairedDevice
};
