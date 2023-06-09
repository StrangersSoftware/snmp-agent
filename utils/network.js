
const moment = require('moment');
const fs = require('fs');

const getAdapters = (error, table) => {
    var columns = [2, 7, 8, 6];
    var indexes = [];
    var mac_addresses = [];
    if (error) {
      const fileName = moment().format('DD-MM-YYYY');
      const timeStamp = moment().format('HH:mm:ss');
      if(error.name === 'RequestTimedOutError') console.error('Network adapters check: Request timed out. Possible wrong parameters reasons: community name, port number or SNMP service/daemon fail.') ;
        else console.error('Network adapters check:', error.message);
      fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - Network adapters check: ${error.message}.\n` );
      } else {
        for (let index in table) 
        {
          if(table[index][columns[3]].length && !mac_addresses.some((item) => !Buffer.compare(item, table[index][columns[3]]))) 
          {
            indexes.push (parseInt (index));
            mac_addresses.push(table[index][columns[3]]);
          }
        }
    }

    return indexes.map((index)=> ({ 
      oid: `1.3.6.1.2.1.2.2.1.2.${index}`, 
      description: table[index][columns[0]], 
      status: table[index][columns[1]],
      opStatus: table[index][columns[2]],
      mac: table[index][columns[3]].toString( 'hex' ).match( /.{1,2}/g ).join( ':' ).toUpperCase(),
    }));
}

const agentCheck = (error, table, session, global_net_adapters) => {
  let rez = [];
  const current = getAdapters(error, table);
  
  for(let i = 0; i < current.length; i++ ) 
    if (JSON.stringify(current[i]) !== JSON.stringify(global_net_adapters[i]))
      rez.push({...current[i], description: current[i].description.toString().slice(0, -1)});
  
  if  (rez.length && global_net_adapters.length) {
    const fileName = moment().format('DD-MM-YYYY');
    const timeStamp = moment().format('HH:mm:ss');
    console.log('AGENT REPORT: network adapters table change');

    var options = {agentAddr: '127.0.0.1'};
    var enterpriseOid = "1.3.6.1.4.1.2000.1";

    var varbinds = rez.map((item) => ({
      oid: item.oid,
      type: 4, // OctetString
      value: JSON.stringify(item),
    }));

    fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - AGENT REPORT: network adapters table change \n` );
    fs.appendFileSync(`logs/${fileName}.log`, `${JSON.stringify(varbinds)}\n` );

    session.trap(enterpriseOid, varbinds, options, (e) => { if (e) console.error(e); } );
  }
  return [...current];
}

module.exports = { agentCheck, getAdapters };