#!/bin/bash
PGPASSWORD="$3" psql -U $1 "$2" < $4