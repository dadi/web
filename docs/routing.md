### Routing

{
  "rewrites" : [
    "^(.*[^/])$ $1/ [L,R=301]"
    "^/cars/(.*)$ /cars?makeId=$1"
  ]
}