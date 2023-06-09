const express = require("express");
const bodyParser = require('body-parser');
const network = require('./utils/network');
const hardware = require('./utils/hardware');
const snmp = require("net-snmp");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const port = 3377;

const controlledHostIP = '192.168.43.107';


let globalProps = {
  authKey: "snmpv3pass",
  community: 'public',
  cpu: 60,    
  disk: 90,    
  host: '',
  name: "snmpv3user",
  privKey: "cryptov3pass",
  ram: 80,  
  security: '0',
  trackLan: false,
  trapReceiverIP: '127.0.0.1',
};

function getUser() {

  const level = globalProps.security === '0'
    ? snmp.SecurityLevel.noAuthNoPriv
    : globalProps.security === '1'
      ? snmp.SecurityLevel.authNoPriv
      : snmp.SecurityLevel.authPriv

  return {
    authKey: globalProps.authKey,
    authProtocol: snmp.AuthProtocols.md5,
    level,
    name: globalProps.name,
    privKey: globalProps.privKey,
    privProtocol: snmp.PrivProtocols.aes,
  }
}

app.get('/', async (req, res) => {
  let host;
  const session = globalProps.security === '0'
    ? snmp.createSession(controlledHostIP, globalProps.community)
    : snmp.createV3Session (controlledHostIP, getUser())

  session.get(["1.3.6.1.2.1.1.5.0"], function (error, oid_data) {
    if (error) {
      console.error(error.toString());
    } else {
      if (snmp.isVarbindError(oid_data[0])) {
        console.error(snmp.varbindError(oid_data[0]));
        host = error.toString();
      } else {
        host=`${oid_data[0].value}`;
      }
    }

    res.render('pages/index', {...globalProps, host });
    session.close();
  });
});

app.post('/', (req, res) => {
  let host = 'Connection error!';
  globalProps = {...globalProps, ...req.body};
  globalProps.trackLan = req.body?.trackLan ? true : false;

  const session = globalProps.security === '0'
    ? snmp.createSession(controlledHostIP, globalProps.community)
    : snmp.createV3Session (controlledHostIP, getUser())

  session.get(["1.3.6.1.2.1.1.5.0"], function (error, oid_data) {
    if (error) {
      console.error(error.toString());
      host = error.toString();
    } else {
      if (snmp.isVarbindError(oid_data[0])) {
        console.error(snmp.varbindError(oid_data[0]));
      } else {
        host=`${oid_data[0].value}`;
      }
    }

    res.render('pages/index', {...globalProps, host });
    session.close();
  });


});


var global_net_adapters = [];

setInterval(() => {

  const session = globalProps.security === '0'
    ? snmp.createSession(controlledHostIP, globalProps.community)
    : snmp.createV3Session (controlledHostIP, getUser())

  const trapReceiver = snmp.createSession(globalProps.trapReceiverIP, globalProps.community);

  if (globalProps.trackLan) {
    var network_oid = "1.3.6.1.2.1.2.2";
    var lan_adapter_columns = [2, 7, 8, 6];
    const checkAdapters = (error, table) => {
      global_net_adapters = [...network.agentCheck(error, table, trapReceiver, global_net_adapters)];
    }
    session.tableColumns(network_oid, lan_adapter_columns, 1, checkAdapters);
  }

  var disks_oid = "1.3.6.1.2.1.25.2.3";
  var disks_columns = [2, 3, 4, 5, 6];

  const checkDisks = (error, table) => hardware.agentCheckDisks(error, table, trapReceiver, globalProps.disk);
  session.tableColumns(disks_oid, disks_columns, 20, checkDisks);

  const checkRam = (error, table) => hardware.agentCheckRam(error, table, trapReceiver, globalProps.ram);
  session.tableColumns(disks_oid, disks_columns, 20, checkRam);

  var cpu_oid = "1.3.6.1.2.1.25.3.3";
  var cpu_columns = [2];

  const checkCpu = (error, table) => hardware.agentCheckCpu(error, table, trapReceiver, globalProps.cpu);
  session.tableColumns(cpu_oid, cpu_columns, 20, checkCpu);

}, 3000);

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
