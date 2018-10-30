/*
Use this script to set the following variables that are passed in:
  - fields: This is an array of field that should be retrieved to be used by the integration.
  - fieldsQuery: This variable should be the query string to pass to the integration URL. In case of servicenow, this should be an encoded query.
  - journals: This is an array of journal fields for customer comments
  - journalsQuery: This variable should be the query string to pass to the integration URL. In case of servicenow, this should be an encoded query.

The following objects are passed into the script to use:
  - current: A GlideRecord of the sn_customerservice_integration record you are currently on
  - fieldsQuery: null by default.
  - fields: null by default.
  - journals: null by default.
  - journalsQuery: null by default.
  - logger: A logging utility similar to gs.log. It uses logging levels and orders to help make logging easier to follow
    - The integration automatically puts 'IntegrationRESTUtil - <log number>' at the start of each log so you can sort your messages in order. It is a scoped application so scopes cannot be used.
    - Usage: logger.log(<message>, <level - 'error'|'warning'|'info'|'debug'|'silly'>)
*/

logger.log('Running Asciano Query Mapping Script', 'debug');

// Variables that may be useful
var user = current.u_rest_message.basic_auth_profile.username; // The user on the target system that is used by this integration.
var assignment_group = 'b68717ec3c2b4640c6007943be02a30b'; // RXP

// Get the last updated date.
var d = moment.utc(current.u_last_processed.toString() || '1970-01-01 00:00:01');
var date = d.tz(current.u_timezone.toString()).format("YYYY-MM-DD");
var time= d.tz(current.u_timezone.toString()).format("HH:mm:ss");


/*
Set the query to be the following
  - The record must be updated after our last check for updates
  - The record must not have been last updated by the integration (would cause an endless loop otherwise)
  - The assignment group must be RXP or the vendor must be RXP
*/
/*fieldsQuery = 'sys_updated_on>=javascript:gs.dateGenerate("' + date + '","' + time + '")'
    + '^assignment_group=' + assignment_group
    + '^sys_updated_by!=' + user;*/
fieldsQuery = 'sys_updated_on>=javascript:gs.dateGenerate("' + date + '","' + time + '")'
    + '^sys_class_nameINincident,u_request,rm_enhancement,rm_defect,change_task'
    + '^assignment_group=' + assignment_group
    + '^ORu_integration_idISNOTEMPTY'
    + '^sys_updated_by!=' + user;

/*
Set fields to only return the fields we are using
*/

fields = ['number', 'sys_id', 'sys_class_name', 'short_description', 'description', 'priority', 'u_service_component', 'u_solution', 'closed_at', 'closed_by', 'u_estimated_effort', 'state'];

/*
Listen for Journal fields
*/
journals = ['comments', 'work_notes'];
journalsQuery = 'elementIN' + journals.join(',') 
	+ '^sys_created_on>=javascript:gs.dateGenerate("' + date + '","' + time + '")'
    + '^sys_created_by!=' + user
	+ '^ORDERBYsys_created_on';

logger.log('Finished Query Field', 'debug');
logger.log(fieldsQuery, 'debug');
logger.log(fields.join(','), 'debug');
logger.log(journalsQuery, 'debug');
logger.log(journals.join(','), 'debug');