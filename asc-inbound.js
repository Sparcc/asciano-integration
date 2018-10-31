/*
This script is given a record retrieved by the integration, and is used to transform it into the case record in operate.

The following objects are passed into the script to use:
  - current: A GlideRecord of the sn_customerservice_case record you are integrating with
  - source: The current record in the payload retrieved from the integrated system
  - integration: The sn_customerservice_integration record
  - diff: An object that should contain a diff record for every change the integration made.
    - Schema: {
		field: The field that has had a change made in the case record,
		prev: The previous value of the record,
		newValue: The new value of the record
	}
    - This will create a work note with the following message
      - <field>: "<new value>" (was "<old value>")
  - logger: A logging utility similar to gs.log. It uses logging levels and orders to help make logging easier to follow
    - The integration automatically puts 'IntegrationRESTUtil - <log number>' at the start of each log so you can sort your messages in order. It is a scoped application so scopes cannot be used.
    - Usage: logger.log(<message>, <level - 'error'|'warning'|'info'|'debug'|'silly'>)
*/
logger.log('Running Asciano Inbound Field', 'debug');
var helper = new global.IntegrationRESTHelper();
var cd = helper.simpleDiff(current, source, diff, logger); //commonDiff(current, source, diff, logger);
var findBestMatch = helper.FindBestMatchInListFunction(logger);
var closedStates = ['3','7'];
var isNewRecord = current.isNewRecord();
logger.log('Valid Record: ' + isNewRecord, 'silly');

var grCust = new GlideRecord('customer_account');
grCust.get('83978c6b4f958f00439466a01310c7a2');

var states = {
  incident: {
    '7': '3' //Closed
  },
  u_request: {
    '7': '3' //Closed
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
    '4': '3', // Closed Incomplete
    '7': '3' // Closed Skipped
  }
};

/*
Default Values
*/
if (isNewRecord) {
  logger.log('Creating new record in mapping', 'debug');
  current.account = grCust.sys_id.toString();
  current.contact = grCust.primary_contact.toString();
  current.u_requester_e_mail = grCust.primary_contact.email.toString();
  current.u_external_table = source.sys_class_name.value.toString();
  current.u_zendesk_id = source.number.value.toString();
  current.contact_type = 'integration';
  current.assignment_group = '886babb9db24fe004fdd788bbf9619cb'; // RXP - Support Analysts
} else {
  logger.log('Existing record', 'debug');
}

/*
Retrieved Values
*/
runCommonMapping(current, source);
switch (source.sys_class_name.value) {
  case 'incident':
  logger.log('Asciano inbound - Running incident Mapping', 'debug');
    runIncidentMapping();
    break;
  case 'u_request':
  logger.log('Asciano inbound - Running u_request Mapping', 'debug');
  
  logger.log('Asciano inbound - Running u_request Mapping - Values for estimated and actual fields coming in are : '+source.u_estimated_effort.toString() +' AND '+source.u_time_card_actual_effort.toString(), 'debug');
  
  cd('u_estimated_hours', 'u_estimated_effort');
  cd('u_actual_hours','u_time_card_actual_effort');
  
    runRequestMapping();
    break;
  case 'rm_enhancement':
  logger.log('Asciano inbound - Running rm_enhancement Mapping', 'debug');
    runEnhancementMapping();
    break;
  case 'rm_defect':
  logger.log('Asciano inbound - Running rm_defect Mapping', 'debug');
    runDefectMapping();
    break;
  case 'change_task':
  logger.log('Asciano inbound - Running change_task Mapping', 'debug');
    runChangeTaskMapping();
    break;
  default:
}

function runCommonMapping(current, source) {
  logger.log('Running Common Mapping', 'debug');
  cd('short_description', 'short_description');
  var descriptionChanged = cd('description', 'description');
  if (descriptionChanged) {
    current.u_description = source.description.value.replace(/<br>|<br\/>/, '\n');
  }

  // State
  if (Object.keys(states[source.sys_class_name.value]).indexOf(source.state.value) !== -1) {
    logger.log('Running state mapping', 'silly');
    cd('state', function() {
      logger.log(
        'Current state mapping: ' +
          source.sys_class_name.value +
          ' = ' +
          states[source.sys_class_name.value][source.state.value],
        'silly'
      );
      return states[source.sys_class_name.value][source.state.value];
    });
  } else if(closedStates.indexOf(current.state.toString() !== -1)) {
	  // As there is only mapping for closed/cancelled it means the current record must be open. If this is the case make sure that it is not set to closed or cancelled in our system.
	  cd('state', function() {
		  return 1;
	  });
	  logger.log('Mapped closed state to new', 'silly');
  }
	
  // Closed
  // Only check if the current state is closed as asciano prepopulate some of the information in the backend
  logger.log('Current record is closed? (' + current.state.toString() + ' in [' + closedStates.join() + '])', 'silly');
  if(closedStates.indexOf(current.state.toString() !== -1)) {
	  logger.log('State is closed', 'silly');
	  cd('close_notes', 'u_solution');
	  cd('closed_at', function() {
		  return helper.GetLocalDate(integration.u_timezone.toString(), current.closed_at.toString());
	  }, function() {
		logger.log('Getting local date for closed_at: utc is ' + source.closed_at.value, 'silly');
		logger.log('result is ' + helper.GetLocalDate(integration.u_timezone.toString(), source.closed_at.value), 'silly');
		return helper.GetLocalDate(integration.u_timezone.toString(), source.closed_at);
	  });

	  if (source.closed_by.display_value.length > 0) {
		cd('closed_by',function() {
			return current.closed_by.getDisplayValue();
		}, function() {
		  return fuzzyGetUser(source.closed_by.display_value) || current.closed_by.getDisplayValue();
		});
	  }
  }
  logger.log('End Common Mapping', 'debug');
}

function runEnhancementMapping() {
  cd('category', function() {
    return 2; // Incident
  });

  setSystem();
  setEstimatedActual()
}

function runIncidentMapping() {
  cd('category', function() {
    return 0; // Incident
  });

  setSystem();
  setPriority();
  setEstimatedActual()
  
  
}

function runDefectMapping() {
  cd('category', function() {
    return 3; // Defect
  });
  setPriority();
  setEstimatedActual()
}

function runRequestMapping() {
  cd('category', function() {
    return 1; // Defect
  });
  setSystem();
  setEstimatedActual()
}

function runChangeTaskMapping() {
  cd('category', function() {
    return 4; // Defect
  });
}

function setEstimatedActual(){
  var estimatedChanged = cd('u_estimated_hours', 'u_estimated_effort');
  if (estimatedChanged) {
    logger.log('Asciano inbound - Setting the operate case estimated hours!', 'debug');  
    current.u_estimated_hours = source.u_estimated_effort;
  }
  
  var actualChanged = cd('u_actual_hours','u_time_card_actual_effort');
  if (actualChanged) {
    logger.log('Asciano inbound - Setting the operate case actual hours!', 'debug');    
    current.u_actual_hours = source.u_time_card_actual_effort;
  }
}

function setSystem() {
  cd('u_account_system', function() {
    return (
      fuzzyGetApplication(current.u_account_system, source.u_service_component.display_value.toString()) ||
      current.u_account_system
    ).toString();
  });
}

function setPriority() {
  // priority
  var priorityChanged = cd('priority', function() {
    return priorityMapping(source.priority.value);
  });
  if (source.priority.value == 1 && priorityChanged) {
    current.comments = 'This ticket is a P1 in the Asciano System';
  }
}

function priorityMapping(priority) {
  switch (priority) {
    case '1':
      return '2';
    case '2':
      return '2';
    case '3':
      return '3';
    case '4':
      return '4';
    default:
      return '4';
  }
}

function fuzzyGetApplication(field, application) {
  logger.log('Asciano - Getting application for ' + application, 'debug');
  logger.log('Asciano - Choices: ' + field.getChoices(), 'debug');
  var choices = field.getChoices();

  return findBestMatch(application, choices).toString();
}

function fuzzyGetUser(name) {
  /*
  Client Users
  */
  var grUsers = new GlideRecord('customer_contact');
  grUsers.addQuery('company', gr.sys_id.toString());
  grUsers.addQuery('active', true);
  grUsers.query();

  var contacts = [];
  while (grUsers.next()) {
    contacts.push(grUsers.name.toString());
  }

  /*
  RXP Users
  */
  var grUsers = new GlideRecord('sys_user');
  grUsers.addQuery('company', 'IN', '18e05d7d4fe19780439466a01310c795,b8a9b65b4fcb3200439466a01310c73f'); // RXP Internal and RXP Services
  grUsers.addQuery('active', true);
  grUsers.query();

  while (grUsers.next()) {
    contacts.push(grUsers.name.toString());
  }
  
  return findBestMatch(name, contacts);
}

logger.log('Asciano - Finished Inbound Field', 'debug');
logger.log('Asciano - '+JSON.stringify(diff), 'debug');
