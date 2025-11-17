import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Image } from 'react-native'

const Number = () => {
  return (
    <View style={styles.container}>
      <View style={styles.mainbox}>
        <View>
          <Image
            source={require('../../assets/img/common/logo.png')}
            style={styles.logo}
          />
        </View>
        <View style={styles.heading}>
          <Text style={styles.headingText}>Welcome to Wowsly</Text>
          <Text style={styles.organizer}>Organizer</Text>
        </View>
        <View>
          <Text style={styles.manage}>Manage events & check-ins on the go</Text>
        </View>
        <View style={styles.number}>
          <Text style={styles.mobile}>Mobile Number</Text>
        </View>
      </View>
    </View>
  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',

  },
  mainbox: {
    width: '90%',
    height: '50%',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  logo: {
    width: 50,
    height: 38,
  },
  heading: {
    gap: 4,
    color: '#000',
    flexDirection: 'column',
    // justifyContent:'center',
    alignItems: 'center'
  },
  headingText: {
    fontWeight: '800',
    fontSize: 25,
  },
  organizer: {
    fontWeight: '800',
    fontSize: 25,
    bottom: 8,
  },
  manage: {
    color: 'grey',
    fontSize: 12,
    
  },
  number:{
alignSelf:'flex-start',
marginLeft:25,

  },
  mobile:{
    color:'black',
  },
});

export default Number
