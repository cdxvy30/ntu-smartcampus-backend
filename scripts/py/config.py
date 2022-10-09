from dotenv import dotenv_values

config = dotenv_values(".env")

# Database settings:
databaseData = {
    "user": config["DB_USER"],
    "password": config["DB_PASSWORD"],
    "host": config["DB_HOST"],
    "port": config["DB_PORT"],
    "database": config["DB_DATABASE"]
}

# Web service settings:
userData = {
    'portal_url': 'https://ntu.maps.arcgis.com/',
    'username': config['ARCGIS_USER'],
    'password': config['ARCGIS_PASSWORD']
}

# Project settings:
projectData = {
    'folder_path': config['ARCGIS_PROJECT_PATH'],
    'name': config['ARCGIS_PROJECT_NAME'],
}
