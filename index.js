const express = require("express");
const bodyParser = require('body-parser');
const network = require('./utils/network');
const hardware = require('./utils/hardware');
const snmp = require("net-snmp");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const port = 3000;

let trapReceiverIP = '127.0.0.1';

let diskThreshold = 90;

let ramThreshold = 80;

let cpuThreshold = 60;

let trackLan = false;


app.get('/', async (req, res) => {
  let response = [];
  const session = snmp.createSession("127.0.0.1", "public");
  session.get(["1.3.6.1.2.1.1.5.0"], function (error, oid_data) {
    if (error) {
      console.error(error);
    } else {
      if (snmp.isVarbindError(oid_data[0])) {
        console.error(snmp.varbindError(oid_data[0]));
      } else {
        response.push(`${oid_data[0].value}`);
      }
    }

    res.render('pages/index', {
      ip: trapReceiverIP,
      username: response[0],
      disk: diskThreshold,
      cpu: cpuThreshold,
      lan: trackLan,
      ram: ramThreshold,
    });
    session.close();
  });
});

app.post('/', (req, res) => {
  let response = [];
  trapReceiverIP = req.body.ip || "127.0.0.1";
  diskThreshold = req.body.disk || 90;
  ramThreshold = req.body.ram || 80;
  cpuThreshold = req.body.cpu || 30;
  trackLan = req.body.lan === 'on' || false;
  const session = snmp.createSession("127.0.0.1", "public");

  session.get(["1.3.6.1.2.1.1.5.0"], function (error, oid_data) {
    if (error) {
      console.error(error);
    } else {
      if (snmp.isVarbindError(oid_data[0])) {
        console.error(snmp.varbindError(oid_data[0]));
      } else {
        response.push(`${oid_data[0].value}`);
      }
    }

    res.render('pages/index', {
      ip: trapReceiverIP,
      username: response[0],
      disk: diskThreshold,
      cpu: cpuThreshold,
      lan: trackLan,
      ram: ramThreshold,
    });
    session.close();
  });
});


var global_net_adapters = [];

setInterval(() => {
  const session = snmp.createSession("127.0.0.1", "public");
  const trapReceiver = snmp.createSession(trapReceiverIP, "public");

  if (trackLan) {
    var network_oid = "1.3.6.1.2.1.2.2";
    var lan_adapter_columns = [2, 7, 8, 6];
    const checkAdapters = (error, table) => {
      global_net_adapters = [...network.agentCheck(error, table, trapReceiver, global_net_adapters)];
    }
    session.tableColumns(network_oid, lan_adapter_columns, 1, checkAdapters);
  }

  var disks_oid = "1.3.6.1.2.1.25.2.3";
  var disks_columns = [2, 3, 4, 5, 6];

  const checkDisks = (error, table) => hardware.agentCheckDisks(error, table, trapReceiver, diskThreshold);
  session.tableColumns(disks_oid, disks_columns, 20, checkDisks);

  const checkRam = (error, table) => hardware.agentCheckRam(error, table, trapReceiver, ramThreshold);
  session.tableColumns(disks_oid, disks_columns, 20, checkRam);

  var cpu_oid = "1.3.6.1.2.1.25.3.3";
  var cpu_columns = [2];

  const checkCpu = (error, table) => hardware.agentCheckCpu(error, table, trapReceiver, cpuThreshold);
  session.tableColumns(cpu_oid, cpu_columns, 20, checkCpu);

}, 3000);

app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
