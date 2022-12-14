# Smart Campus Backend

## Environment
#### Configure environment variables according to `.env`
1. Run Powershell as administrator:
  * `git clone https://github.com/rajivharris/Set-PsEnv`
  * `Install-Module -Name Set-PsEnv` : Agree with both following requests
  * `Set-Psenv -?`

2. Edit `.env` file with custom setting, and in `/server`:
  * Temporarily comment **BIMU, SENDGRID, EXEC_MODE, SSH_USER, SSH_PASSWORD** cause some of them will cause server error.
  * `set-psenv`
  * `ls env:` : check the variable in this session.
  * **Notice that environment variables use this way to set up only survive in this session, which means if closing terminal, the variables are not available anymore.**

## Packages (pip, arcpy)
```
C:\"Program Files"\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\Scripts\pip.exe install psycopg2
Collecting psycopg2
C:\"Program Files"\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\Scripts\pip.exe install python-dotenv
```

## Deploy
* `npm run-script build` : generate `/build` folder.
* `npm start`