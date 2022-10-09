if [ "$(PGPASSWORD=$1 psql -U $1 -tAc 'select 1' -d $3 || echo 0 )" = '1' ]
then
    echo "true"
else
    echo "false"
fi