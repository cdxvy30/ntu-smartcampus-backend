#!/bin/bash
PGPASSWORD="$3" pg_dump -U $1 -d "$2" -f $4