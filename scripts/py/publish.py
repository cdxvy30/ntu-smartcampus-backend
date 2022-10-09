import os
import sys
import shutil
import arcpy

folder_path = None
project_name = None
project_path = None

aprx = None
map3D = None
gdb = None
wgs84 = arcpy.SpatialReference(4326)

sddraft_output_filename = None
sd_output_filename = None

def SignInArcgis(arcgis_user, arcgis_pass, arcgis_portal):
    try:
        userData = {
            'username': arcgis_user,
            'password': arcgis_pass,
            'portal_url': arcgis_portal,
        }
        arcpy.SignInToPortal(**userData)
    except:
        raise Exception('Authentication Error') from None

def CloneProject(id):
    try:
        global aprx
        global map3D
        global gdb
        global folder_path
        global project_name
        global project_path

        folder_path = os.path.abspath(os.path.join(os.getcwd(), 'projects'))
        src = os.path.join(folder_path, 'BaseProject')
        dst = os.path.join(folder_path, id)
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

        project_name = 'BaseProject'
        project_path = os.path.join(dst, f'{project_name}.aprx')
        aprx = arcpy.mp.ArcGISProject(project_path)
        map3D = aprx.listMaps("Map")[0]
        gdb = aprx.defaultGeodatabase

        arcpy.env.workspace = gdb
        arcpy.env.overwriteOutput = True
    except:
        raise Exception('System Error') from None

def SetConfig(id, name):
    try:
        global sddraft_output_filename
        global sd_output_filename

        outdir = os.path.join(folder_path, id, "web")
        if not os.path.exists(outdir):
            os.mkdir(outdir)
        
        service_name = name
        sddraft_filename = service_name + ".sddraft"
        sddraft_output_filename = os.path.join(outdir, sddraft_filename)
        sd_filename = service_name + ".sd"
        sd_output_filename = os.path.join(outdir, sd_filename)
    except:
        raise Exception('System Error') from None

def AddShapefile(filenames):
    try:
        global map3D
        global aprx
        global folder_path

        filename_array = filenames.split(',')
        for filename in filename_array:
            file_folder_path = os.path.join(folder_path, id + '_files')
            shp_path = os.path.join(file_folder_path, filename, filename + '.shp')
            map3D.addDataFromPath(shp_path)
        aprx.save()
    except:
        raise Exception('Format Error') from None

def publishService(service_name):
    try:
        global sddraft_output_filename
        global sd_output_filename
        global map3D

        server_type = "HOSTING_SERVER"
        sddraft = map3D.getWebLayerSharingDraft(server_type, "FEATURE", service_name)
        sddraft.overwriteExistingService = True
        sddraft.exportToSDDraft(sddraft_output_filename)

        arcpy.StageService_server(sddraft_output_filename, sd_output_filename)
        arcpy.UploadServiceDefinition_server(sd_output_filename, server_type)
    except:
        raise Exception('Connection Error') from None

if __name__ == "__main__":
    id = sys.argv[1]
    arcgis_user = sys.argv[2]
    arcgis_pass = sys.argv[3]
    arcgis_portal = sys.argv[4]
    service_name = sys.argv[5]
    filenames = sys.argv[6]
    SignInArcgis(arcgis_user, arcgis_pass, arcgis_portal)
    CloneProject(id)
    SetConfig(id, service_name)
    AddShapefile(filenames)
    publishService(service_name)