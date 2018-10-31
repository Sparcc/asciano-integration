/*
This script is used to transform the Case record in Operate into the target systems record.

The following objects are passed into the script to use:
  - current: A GlideRecord of the sn_customerservice_case record you are integrating with
  - payload: The object that will be sent to the integration.
  - logger: A logging utility similar to gs.log. It uses logging levels and orders to help make logging easier to follow
    - The integration automatically puts 'IntegrationRESTUtil - <log number>' at the start of each log so you can sort your messages in order. It is a scoped application so scopes cannot be used.
    - Usage: logger.log(<message>, <level - 'error'|'warning'|'info'|'debug'|'silly'>)
*/
var fields = current.u_migrate_fields && current.u_migrate_fields.toString().split(',') || [];
var pc = postIfChanged(current, payload, logger, fields);

/*
	State Mapping
*/
var states = {
  incident: {
    '3': '7', //Closed
	'7': '7'
  },
  u_request: {
    '3': '7', //Closed
	'7': '7'
  },
  rm_enhancement: {
    '3': '3', //Closed Complete
    '7': '7' //Cancelled
  },
  rm_defect: {
    '3': '3', //Closed Complete
    '7': '7' //Cancelled
  },
  change_task: {
    '3': '3', // Closed Complete
	'7': '3'
  }
};


runCommonMapping(current, payload);
switch (current.u_external_table.toString()) {
  case 'incident':
	logger.log('Asciano outbound - Running Incident Mapping', 'debug');
    runIncidentMapping(current, payload);
	break;
  case 'u_request':
	logger.log('Asciano outbound - Running u_request Mapping', 'debug');
    
    logger.log('Asciano outbound - Running u_request Mapping - Values for estimated and actual fields leaving are : '+current.u_estimated_hours +' AND '+current.u_actual_hours, 'debug');
    
    runRequestMappingMapping(current, payload);
	break;
  case 'rm_enhancement':
	logger.log('Asciano outbound - Running rm_enhancement Mapping', 'debug');
    runEnhancementMappingMapping(current, payload);
	break;
  case 'rm_defect':
	logger.log('Asciano outbound - Running rm_defect Mapping', 'debug');
    runDefectMappingMapping(current, payload);
	break;
  case 'change_task':
	logger.log('Asciano outbound - Running change_task Mapping', 'debug');
	break;
  default:
	logger.log('Asciano outbound - No Mapping for ' + current.u_external_table.toString(), 'debug');
}

function runCommonMapping(current, payload) {
  logger.log('Asciano - Running common mapping', 'debug');
  payload.u_integration_id = current.number.toString();
  pc('short_description');

  pc('close_notes', 'u_solution');
  pc('closed_at', 'closed_at');
  pc('closed_by', 'closed_by', gs.getUserName());
  
	
  logger.log('Asciano - Checking for state mapping. Current State (' + current.state.toString() + ') in ' + JSON.stringify(states[current.u_external_table.toString()]), 'silly');
  var map = states[current.u_external_table.toString()];
  if(map && map[current.state.toString()]) {
	logger.log('Asciano - State mapping found', 'silly');
    pc('state', 'state', map[current.state.toString()]);
  }
}

function runEnhancementMapping(current, payload) {
    pc('u_estimated_hours','u_estimated_effort');
    pc('u_actual_hours','u_time_card_actual_effort');
}

function runIncidentMapping(current, payload) {
    pc('priority');
    pc('u_estimated_hours','u_estimated_effort');
    pc('u_actual_hours','u_time_card_actual_effort');
}

function runDefectMapping(current, payload) {
    pc('u_estimated_hours','u_estimated_effort');
    pc('u_actual_hours','u_time_card_actual_effort');
}

function runRequestMapping(current, payload) {
    pc('u_estimated_hours','u_estimated_effort');
    pc('u_actual_hours','u_time_card_actual_effort');
}

function postIfChanged(current, payload, logger, fields) {
	return function(currentField, payloadField, overrideValue) {
		logger.log("Asciano - Checking if field '" + currentField + "' changed", 'silly');
		if(fields.indexOf(currentField) != -1 || fields.length == 0) {
			logger.log('Asciano - Field Changed', 'silly');
			payload[payloadField||currentField] = overrideValue || current[currentField].toString();
            logger.log("Asciano -  outbound script payload - " + JSON.stringify(payload), 'debug');
			return true;
		}
		logger.log('Asciano - Field NOT Changed', 'silly');
		return false;
	};
}