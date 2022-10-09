import os
import sys
import copy
import json
import shutil
import initialize
import config
import arcpy
import psycopg2

project = None
projectPath = None

aprx = None
map3D = None
gdb = None
twd97 = arcpy.SpatialReference(3826)
wgs84 = arcpy.SpatialReference(4326)

buildingExistingLyrPath = None
buildingNewLyrName = None


def CloneProject():
    global project
    global projectPath
    global aprx
    global map3D
    global gdb
    global buildingExistingLyrPath
    global buildingNewLyrName

    src = initialize.folderPath
    dst = os.path.join(config.projectData["folder_path"], 'tmp')
    symlinks = False
    ignore = None

    os.mkdir(dst)

    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, symlinks, ignore)
        else:
            shutil.copy2(s, d)

    project = config.projectData["name"]
    projectPath = os.path.join(dst, f'{project}.aprx')
    aprx = arcpy.mp.ArcGISProject(projectPath)
    map3D = aprx.listMaps("Map")[0]
    gdb = aprx.defaultGeodatabase

    arcpy.env.workspace = gdb
    arcpy.env.overwriteOutput = True
    # map3D.addBasemap(basemap)

    buildingExistingLyrPath = os.path.join(
        gdb, initialize.existingBuildingLyrName)
    buildingNewLyrName = initialize.newBuildingLyrName


def SignInArcgis():
    callbackUserData = arcpy.SignInToPortal(**config.userData)


def CreateBuildingFeature():
    if not arcpy.Exists(buildingNewLyrName):
        arcpy.management.CopyFeatures(
            buildingExistingLyrPath, buildingNewLyrName)
        for buildingTemplateField in initialize.buildingTemplateFields:
            arcpy.management.AddField(
                buildingNewLyrName, **buildingTemplateField)

        print(f"\nCreated feature class, [{buildingNewLyrName}]!\n")
    else:
        print(
            f"\nFeature class, [{buildingNewLyrName}], has already existed! Needn't create new feature class!\n")

    buildingTblName = initialize.buildingTblName
    # building3D_LyrName = initialize.building3D_LyrName
    data_struct = initialize.buildingFeatures
    if not arcpy.Exists(buildingTblName):
        arcpy.management.CreateTable('', buildingTblName)
        for i in range(len(data_struct)):
            if data_struct[i]["type"] == 'int':
                arcpy.management.AddField(
                    buildingTblName, data_struct[i]["name"].replace(' ', '_'), 'FLOAT', field_is_nullable="NULLABLE")
            elif data_struct[i]["type"] == 'double':
                arcpy.management.AddField(
                    buildingTblName, data_struct[i]["name"].replace(' ', '_'), 'FLOAT', field_is_nullable="NULLABLE")
            elif data_struct[i]["type"] == 'string':
                arcpy.management.AddField(
                    buildingTblName, data_struct[i]["name"].replace(' ', '_'), 'TEXT', field_length=100, field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[0], 'TEXT', field_length=20, field_is_nullable="NON_NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[1], 'TEXT', field_length=40, field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[2], 'TEXT', field_length=10, field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[3], 'SHORT', field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[4], 'SHORT', field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[5], 'FLOAT', field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[6], 'SHORT', field_is_nullable="NULLABLE")
        # arcpy.management.AddField(
        #     buildingTblName, buildingFeatures[7], 'FLOAT', field_is_nullable="NULLABLE")
        # print(f"\nCreated feature class, [{buildingTblName}]!\n")
    else:
        print(
            f"\nFeature class, [{buildingTblName}], has already existed! Needn't create new feature class!\n")


def InsertTreeData(tree, x_property_name, y_property_name):
    newTreeFeatures = []
    for feature in treeFeatures:
        if (feature == x_property_name):
            continue
        if (feature == y_property_name):
            continue
        newTreeFeatures.append(feature.replace(' ', '_'))

    try:
        with arcpy.da.InsertCursor(treeLyrName, ['SHAPE@XY']+newTreeFeatures) as treeCursor:
            tree = copy.deepcopy(tree)
            coord = tree.pop('twd97Coordinate')
            if coord[0] and coord[1]:
                newData = [coord]
                newData.extend(list(tree.values()))
                newData.append(0.)
                treeCursor.insertRow(newData)
    except Exception as e:
        print(f'\n----------\nError in InsertTreeData:\n  {e}\n')
        print(f'Tree data: {tree}\n----------\n')


def ConnectDB():
    global dbConnection

    try:
        dbConnection = psycopg2.connect(user="postgres",
                                        password="postgres",
                                        host="127.0.0.1",
                                        port="5432",
                                        database="Smart-City")

    except (Exception, psycopg2.Error) as error:
        print("Error while connecting to PostgreSQL", error)


def GetColumnFromDB(tbl_name):
    global dbConnection
    global treeFeatures

    columns = []
    cursor = dbConnection.cursor()

    queryStr = f"Select * FROM {tbl_name} LIMIT 0"

    cursor.execute(queryStr)
    records = [desc[0] for desc in cursor.description]

    records = records[1:-2]
    treeFeatures = records
    treeFeatures.append('z')


def InsertDataFromDB(tbl_name, x_property_name, y_property_name):
    global dbConnection
    global treeFeatures

    try:
        cursor = dbConnection.cursor()
        queryStr = "select * from " + tbl_name
        cursor.execute(queryStr)
        records = cursor.fetchall()

        for row in records:
            tree = {}
            # tree['treeID'] = row[1]
            # tree['name'] = row[2]
            # tree['growthFrom'] = row[3]
            # tree['treeCrownHeight'] = row[4]
            # tree['treeHeight'] = row[5]
            # tree['twd97Coordinate'] = [row[6], row[7]]
            # tree['TCO2'] = row[8]
            # tree['response'] = None
            row = row[1:-2]
            for i in range(len(row)):
                if treeFeatures[i] == x_property_name:
                    if ('twd97Coordinate' not in tree):
                        tree['twd97Coordinate'] = []
                        tree['twd97Coordinate'].append(row[i])
                    else:
                        tree['twd97Coordinate'].insert(0, row[i])
                elif treeFeatures[i] == y_property_name:
                    if ('twd97Coordinate' not in tree):
                        tree['twd97Coordinate'] = []
                        tree['twd97Coordinate'].append(row[i])
                    else:
                        tree['twd97Coordinate'].append(row[i])
                else:
                    tree[treeFeatures[i].replace(' ', '_')] = row[i]
            InsertTreeData(tree, x_property_name, y_property_name)

    except (Exception, psycopg2.Error) as error:
        print("Error while fetching data from PostgreSQL", error)

    finally:
        if dbConnection:
            cursor.close()
            dbConnection.close()
            # print("PostgreSQL connection is closed")


def AddTreeLayerToMap():
    arcpy.ddd.FeatureTo3DByAttribute(treeLyrName, treeLyr3DName, 'z')
    lyr = arcpy.management.MakeFeatureLayer(
        treeLyr3DName, treeLyr3DName).getOutput(0)
    sym = lyr.symbology
    sym.renderer.symbol.color = {'RGB': [30, 130, 48, 0]}
    lyr.symbology = sym
    d = lyr.getDefinition('V2')
    d.useRealWorldSymbolSizes = True
    lyr.setDefinition(d)
    map3D.addLayer(lyr)


def create_layer(tbl_name, x_property_name, y_property_name, data_struct):
    SignInArcgis()
    CreateBuildingFeature(data_struct, x_property_name, y_property_name)
    ConnectDB()
    GetColumnFromDB(tbl_name)
    InsertDataFromDB(tbl_name, x_property_name, y_property_name)
    AddTreeLayerToMap()

    aprx.save()
    # print(f'[{project}] saved!')

    sharingDraft = map3D.getWebLayerSharingDraft(
        initialize.serverType, initialize.serviceType, initialize.service)
    sharingDraft.summary = initialize.sharingDraftAttr['summary']
    sharingDraft.tags = initialize.sharingDraftAttr['tags']
    sharingDraft.description = initialize.sharingDraftAttr['description']
    sharingDraft.overwriteExistingService = initialize.sharingDraftAttr[
        'overwriteExistingService']
    sharingDraft.exportToSDDraft(initialize.sddraftOutputFilename)

    arcpy.server.StageService(
        initialize.sddraftOutputFilename, initialize.sdOutputFilename)
    outServiceDefinitions = arcpy.server.UploadServiceDefinition(
        **initialize.uploadAttr)

    for i in range(outServiceDefinitions.outputCount):
        initialize.serviceDefinitions[initialize.serviceDefinitionFeatures[i]
                                      ] = outServiceDefinitions.getOutput(i)
    with open(initialize.serviceDefinitionsJSON, 'w', encoding='utf-8') as f:
        json.dump(initialize.serviceDefinitions, f, ensure_ascii=False)

    print('Successfully uploaded GIS service!')
    # print(gdb)


if __name__ == "__main__":
    tbl_name = sys.argv[1]
    x_property_name = sys.argv[2]
    y_property_name = sys.argv[3]
    data_struct = json.loads(sys.argv[4])
    CloneProject()
    create_layer(tbl_name, x_property_name, y_property_name, data_struct)
