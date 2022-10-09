import os
import config

# Initialize project:
project = config.projectData["name"]
folderPath = os.path.join(config.projectData["folder_path"], project)
projectPath = os.path.join(folderPath, f'{project}.aprx')
webDir = os.path.join(folderPath, 'Web')
if not os.path.exists(webDir):
    os.mkdir(webDir)


existingBuildingLyrName = 'ElectricityFinal'
newBuildingLyrName = 'NewElectricityFinal'

buildingFeatures = [
    {'name': 'uid', 'type': 'string'},
    {'name': 'building_name', 'type': 'string'},
    {'name': 'type', 'type': 'string'},
    {'name': 'floor', 'type': 'int'},
    {'name': 'basement', 'type': 'int'},
    {'name': 'area', 'type': 'double'},
    {'name': 'birth_year', 'type': 'int'},
    {'name': 'height', 'type': 'double'}
]

buildingTemplateFields = [{'field_name': 'Data', 'field_type': 'FLOAT'}]

buildingTblName = 'NTU_Building'
building3D_LyrName = buildingTblName+'_3D_with_Data'


service = project
serverType = 'HOSTING_SERVER'
serviceType = 'FEATURE'
sharingDraftAttr = {
    'summary': "Test",
    'tags': "Test",
    'description': "Test",
    'overwriteExistingService': True
}

sddraftFilename = service + ".sddraft"
sddraftOutputFilename = os.path.join(webDir, sddraftFilename)
sdFilename = service + ".sd"
sdOutputFilename = os.path.join(webDir, sdFilename)

uploadAttr = {
    'in_sd_file': sdOutputFilename,
    'in_server': "HOSTING_SERVER",
    'in_startupType': "STARTED",
    'in_public': "PUBLIC",
    'in_override': "OVERRIDE_DEFINITION"
}

serviceDefinitionFeatures = ['soap_svc_url',
                             'rest_svc_url',
                             'mapServiceItemID',
                             'featServiceItemID',
                             'cached_service',
                             'featureServiceURL',
                             'mapServiceURL',
                             'LayerIDMap',
                             'standaloneTableIDMap',
                             'vectorTileServiceID',
                             'vectorTileServiceURL']

serviceDefinitions = {feature: '' for feature in serviceDefinitionFeatures}
serviceDefinitionsJSON = os.path.join(
    webDir, f'{service}_ServiceDefinition.json')
