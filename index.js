const express = require("express");
const bodyParser = require('body-parser');
const network = require('./utils/network');
const hardware = require('./utils/hardware');
const moment = require('moment');
const snmp = require("net-snmp");
const fs = require('fs');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');


const port = 3377;

const controlledHostIP = '127.0.0.1';

var global_params = {
  community_name: '',
  cpu_threshold: 0,
  disk_threshold: 0,
  inform_network_status: true,
  port_number: 162,
  ram_threshold: 0,
  run_every_in_minute: 5,
  security: 'NoAuthNoPriv',
  services_list: '',
  trap_receiver_ip: '',
  user_key: '',
  user_name: '',
  user_password: '',
};

function getUser() {

  const level = global_params.security === 'NoAuthNoPriv'
    ? snmp.SecurityLevel.noAuthNoPriv
    : global_params.security === 'AuthNoPriv'
      ? snmp.SecurityLevel.authNoPriv
      : snmp.SecurityLevel.authPriv

  return {
    authKey: global_params.user_password,
    authProtocol: snmp.AuthProtocols.md5,
    level,
    name: global_params.user_name,
    privKey: global_params.user_key,
    privProtocol: snmp.PrivProtocols.aes,
  }
}

app.get('/', async (req, res) => {
  let host;
  const session = global_params.security === 'NoAuthNoPriv'
    ? snmp.createSession(controlledHostIP, global_params.community_name)
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

    res.render('pages/index', {...global_params, host });
    session.close();
  });
});

app.post('/', (req, res) => {
  let host = 'Connection error!';
  global_params = {...global_params, ...req.body};
  global_params.inform_network_status = req.body.inform_network_status ? true : false;

  const session = global_params.security === 'NoAuthNoPriv'
    ? snmp.createSession(controlledHostIP, global_params.community_name)
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

    res.render('pages/index', {...global_params, host });
    session.close();
  });
});


var global_net_adapters = [];
var checkInterval = null;

const paramsToCheck = [
  'community_name', 
  'cpu_threshold', 
  'disk_threshold', 
  'inform_network_status', 
  'port_number',
  'ram_threshold', 
  'run_every_in_minute',
  'security',
  'services_list',
  'trap_receiver_ip',
  'user_key',
  'user_name',
  'user_password',
]

setInterval(() => {
  const fileName = moment().format('DD-MM-YYYY');
  const timeStamp = moment().format('HH:mm:ss');
  let rawData = null;
  try {
    rawData = fs.readFileSync('/usr/local/etc/global_config.json')
  } catch(e){}

  if (!fs.existsSync('logs')) fs.mkdirSync('logs');

  if (rawData) {
    let allConfig = JSON.parse(rawData);
    console.log('duty config file check');
    fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - duty config file check\n` );

    if(allConfig.snmp_config && allConfig.snmp_config.length) {
      
      const snmp_config= allConfig.snmp_config.find(({is_default}) => is_default)

      if ((paramsToCheck.some((param) => global_params[param] != snmp_config[param])) && checkInterval) {
        console.log('previous config cancelled');
        fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - previous config cancelled\n` );
        clearInterval(checkInterval);
        checkInterval = null;
      }

      if (!checkInterval) {
        console.log('config selected and started: ', snmp_config);
        fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - config selected and started: ${JSON.stringify(snmp_config)}\n` );

        global_params = snmp_config;

        checkInterval = setInterval(() => {
          

          const session = snmp_config.security === 'NoAuthNoPriv'
            ? snmp.createSession(controlledHostIP, snmp_config.community_name)
            : snmp.createV3Session (controlledHostIP, getUser())

          const trapReceiver = snmp.createSession(snmp_config.trap_receiver_ip, snmp_config.community_name);

          const current = moment().format('HH:mm:ss');
          console.log('host props check');
          fs.appendFileSync(`logs/${fileName}.log`, `${current} - host props check\n` );

          if (snmp_config.inform_network_status) {
            var network_oid = "1.3.6.1.2.1.2.2";
            var lan_adapter_columns = [2, 7, 8, 6];
            const checkAdapters = (error, table) => {
              global_net_adapters = [...network.agentCheck(error, table, trapReceiver, global_net_adapters)];
            }
            session.tableColumns(network_oid, lan_adapter_columns, 1, checkAdapters);
          }
        
          var disks_oid = "1.3.6.1.2.1.25.2.3";
          var disks_columns = [2, 3, 4, 5, 6];
        
          const checkDisks = (error, table) => hardware.agentCheckDisks(error, table, trapReceiver, snmp_config.disk_threshold);
          session.tableColumns(disks_oid, disks_columns, 20, checkDisks);
        
          const checkRam = (error, table) => hardware.agentCheckRam(error, table, trapReceiver, snmp_config.ram_threshold);
          session.tableColumns(disks_oid, disks_columns, 20, checkRam);
        
          var cpu_oid = "1.3.6.1.2.1.25.3.3";
          var cpu_columns = [2];
        
          const checkCpu = (error, table) => hardware.agentCheckCpu(error, table, trapReceiver, snmp_config.cpu_threshold);
          session.tableColumns(cpu_oid, cpu_columns, 20, checkCpu);
        }, snmp_config.run_every_in_minute * 60000);
      }
    } else {
      console.log('SNMP config was not found in file');
      fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - SNMP config was not found\n` );
    }
  } else {
    console.log('SNMP config file was not found');
    fs.appendFileSync(`logs/${fileName}.log`, `${timeStamp} - SNMP config file was not found\n` );
  }

}, 20000);



app.get('/about', function(req, res) {
  res.render('pages/about');
});

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
