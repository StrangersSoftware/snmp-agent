
const getDisks = (error, table) => {
  var columns = [2, 3, 4, 5, 6];
  var indexes = [];
  var names = [];
  if (error) {
      console.error (error.toString ());
  } else {
      for (let index in table) 
      {
        if(table[index][columns[1]].length && !names.some((item) => !Buffer.compare(item, table[index][columns[1]]))) 
        {
          indexes.push (parseInt (index));
          names.push(table[index][columns[1]]);
        }
      }
  }

  return indexes.map((index)=> ({ 
    oid: `1.3.6.1.2.1.25.2.3.1.3.${index}`, 
    type: table[index][columns[0]],
    description: table[index][columns[1]],
    units: table[index][columns[2]],
    size: table[index][columns[3]],
    used: table[index][columns[4]] 
  }));
}

const getCpu = (error, table) => {
  var columns = [2];
  var indexes = [];
  var names = [];
  if (error) {
      console.error (error.toString ());
  } else {
      for (let index in table) 
      {
        indexes.push (parseInt (index));
        names.push(table[index][columns[0]]);
      }
  }

  return indexes.map((index)=> ({ 
    oid: `1.3.6.1.2.1.25.3.3.1.2.1.${index}`, 
    load: table[index][columns[0]],
  }));
}

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const agentCheckDisks = (error, table, session, threshold) => {
  const disksTable = getDisks(error, table);
  const lowDisks = disksTable.filter(disk => (disk.used / disk.size * 100) > threshold && disk.type === '1.3.6.1.2.1.25.2.1.4');
  if  (lowDisks.length) {
    console.log('AGENT REPORT: disks threshold alert');

    const options = {agentAddr: '127.0.0.1'};
    const appOid = "1.3.6.1.4.1.2001.1";
    
    var appVarbind = lowDisks.map(disk => ({
      oid: disk.oid,
      type: 4,
      value: `${disk.description.toString()} - used ${formatBytes(disk.used * disk.units)} of ${formatBytes(disk.size * disk.units)}`,
    }) );
    session.trap(appOid, appVarbind, options, function (error) { if (error) console.error (error); })
  }
}

const agentCheckRam = (error, table, session, threshold) => {
  const disksTable = getDisks(error, table);

  const lowDisks = disksTable.filter(disk => (disk.used / disk.size * 100) > threshold && disk.type === '1.3.6.1.2.1.25.2.1.2');
  if  (lowDisks.length) {
    console.log('AGENT REPORT: ram threshold alert');

    const options = {agentAddr: '127.0.0.1'};
    const appOid = "1.3.6.1.4.1.2002.1";
    
    var appVarbind = lowDisks.map(disk => ({
      oid: disk.oid,
      type: 4,
      value: `${disk.description.toString()} - used ${formatBytes(disk.used * disk.units)} of ${formatBytes(disk.size * disk.units)}`,
    }) );
    session.trap(appOid, appVarbind, options, function (error) { if (error) console.error (error); })
  }
}

const agentCheckCpu = (error, table, session, threshold) => {
  const cpuTable = getCpu(error, table);

  const highCpu = cpuTable.filter(core => core.load > threshold );

  if  (highCpu.length) {
    console.log('AGENT REPORT: cpu threshold alert');
    const options = {agentAddr: '127.0.0.1'};
    const appOid = "1.3.6.1.4.1.2003.1";
    
    var appVarbind = highCpu.map(core => ({
      oid: core.oid,
      type: 4,
      value: `${highCpu.length} cores of  ${cpuTable.length} loaded more than ${threshold}%`,
    }) );
    session.trap(appOid, appVarbind, options, function (error) { if (error) console.error (error); })
  }
}

module.exports = { agentCheckDisks, agentCheckRam, agentCheckCpu };