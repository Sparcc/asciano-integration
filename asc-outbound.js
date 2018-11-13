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

// Current (RXP) to Payload (Asciano) state mapping values
var states = {
  incident: {
    '1': '1', //New
    '2': '-11', // Work in Progress - Awaiting 3rd Party
    '13': '-11', //System Testing - Awaiting 3rd party 
    '14': '-11', //UAT - Awaiting Awaiting 3rd Party
    '15': '-20', //Monitoring to Monitoring
    '24': '-10', //Client Hold - Waiting Customer
    '6': '6' //Resolved
  },
  u_request: {
    '1': '1', //New
    '2': '-11', //Work in Progress - Awaiting 3rd Party
    '13': '-11', //System Testing - Awaiting 3rd Party
    '14': '-11', //UAT - Awaiting 3rd Party
    '23': '2', //Client Action Required - In Progress
    '24': '-10', //Client Hold - Awaiting Customer
    '6': '6' //Resolved
  },
  rm_enhancement: {
    '10': '-5', //Under Review - Work In Progress
    '2': '-5', //Work In Progress  - In Development
    '23': '8', //Client Action Required - On Hold
    '24': '8', //Pending Client Hold - On Hold
    '13': '31', //System Testing - Ready SIT - 
    '14': '-4', //UAT - Ready UAT - 
    '40': '33', //Ready for Release - Ready PROD - 
    '7': '7' //Cancelled
  },
  rm_defect: {
    '-5': '2', //In Development - Work In Progress
    '8': '23', //On Hold - Client Action Required
    '10': '13', //Ready SIT - System Testing
    '11': '14', //Ready UAT - UAT
    '6': '40' //Ready PROD - Ready for Release
  },
  change_task: {
    '1': '1', //Open - New
    '2': '10', //In Progress - Under Review
    '-5': '23', //On Hold - Client Action Required
    '3': '6' //Completed - Resolved
  }
};

// Closed States
var closedStates = {
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
    runRequestMapping(current, payload);
	break;
  case 'rm_enhancement':
	logger.log('Asciano outbound - Running rm_enhancement Mapping', 'debug');
    runEnhancementMapping(current, payload);
	break;
  case 'rm_defect':
	logger.log('Asciano outbound - Running rm_defect Mapping', 'debug');
    runDefectMapping(current, payload);
	break;
  case 'change_task':
	logger.log('Asciano outbound - Running change_task Mapping', 'debug');
	break;
  default:
	logger.log('Asciano outbound - No Mapping for ' + current.u_external_table.toString(), 'debug');
}

function runCommonMapping(current, payload) {
  logger.log('Asciano outbound - Running common mapping', 'debug');
  payload.u_integration_id = current.number.toString();
  pc('short_description');
  pc('description');

  pc('close_notes', 'u_solution');
  pc('closed_at', 'closed_at');
  pc('closed_by', 'closed_by', gs.getUserName());
  
  logger.log('Asciano outbound:'
  + '\nWe are mapping to - '+current.u_external_table.toString()
  + '\nState value of current is - '+current.state
  + '\nState is type of - '+typeof(current.state)
  + '\nState value is - '+current.state.value
  + '\nState value to set payload is- '+states[current.u_external_table.toString()][current.state.toString()]
  , 'debug');
  
  // State mapping
  // Check if there is a mapped value first
  if (Object.keys(states[current.u_external_table.toString()]).indexOf(current.state.toString()) !== -1) {
    //check unmapped value (need to change this) against current and then set payload
    pc('state', 'state', states[current.u_external_table.toString()][current.state.toString()]);
  }
  /*
  logger.log('Asciano outbound - Checking for state mapping. Current State (' + current.state.toString() + ') in ' + JSON.stringify(states[current.u_external_table.toString()]), 'silly');
  var map = states[current.u_external_table.toString()];
  if(map && map[current.state.toString()]) {
	logger.log('Asciano outbound - State mapping found', 'silly');
    pc('state', 'state', map[current.state.toString()]);
  }
  */
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
		logger.log("Asciano outbound - Checking if field '" + currentField + "' changed", 'silly');
        
        //Check if different
		if(fields.indexOf(currentField) != -1 || fields.length == 0) {
			logger.log('Asciano outbound - Field Changed', 'silly');
			payload[payloadField||currentField] = overrideValue || current[currentField].toString();
            logger.log("Asciano outbound -  outbound script payload - " + JSON.stringify(payload), 'debug');
			return true;
		}
		logger.log('Asciano outbound - Field NOT Changed', 'silly');
		return false;
	};
}