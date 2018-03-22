#/bin/sh

if [ $# -eq 1 ]
then 
  NAME=`grep name $1 | head -n1 | awk '{print $2}'`
  NS=`grep namespace $1 | head -n1 | awk '{print $2}'`
  istioctl get routerule $NAME -n $NS | grep -v "No resources"
  if [ $? -eq 1 ]
  then
    istioctl create -n $NS -f $1
  else
    istioctl replace -n $NS -f $1
  fi
else
  echo "Usage: install-istio-rule.sh <rulefile>"
fi

