import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native'
import React from 'react'
import { Image } from 'react-native'
import { useState } from "react";


const Number = () => {
  const [selectedCode, setSelectedCode] = useState("+91");
const [phone, setPhone] = useState("");

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
          <View style={styles.inputContainer}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{selectedCode}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter your 10-digit number"
              placeholderTextColor="#A0A0A0"
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <Text style={styles.infoText}>You’ll receive a 6-digit code via SMS</Text>
        </View>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Send OTP</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Need help?</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Privacy</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.footerText}>Terms</Text>
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
    height: '42%',
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
    alignItems: 'center',
 
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
marginLeft:'8%',
marginTop:'8%',


  },
  mobile:{
    color:'black',
  },
  inputContainer:{
    flexDirection:'row',
    alignItems:'center',
    borderWidth:1,
    borderColor:'#E0E0E0',
    borderRadius:15,
    paddingHorizontal:16,
    marginTop:10,
    width:'90%',
    height:'30%',
    backgroundColor:'#fff'
  },
  codeBox:{
    paddingRight:16,
    borderRightWidth:1,
    borderRightColor:'#E0E0E0'
  },
  codeText:{
    fontSize:16,
    fontWeight:'600',
    color:'#000'
  },
  input:{
    flex:1,
    paddingLeft:16,
    fontSize:15,
    color:'#000'
  },
  infoText:{
    color:'#7E7E7E',
    fontSize:12,
    marginTop:8
  },
  button:{
    // marginTop:30,
    width:'85%',
    height:'12%',
    borderRadius:15,
    backgroundColor:'#FF8A3C',
    alignItems:'center',
    justifyContent:'center',
  },
  buttonText:{
    color:'#fff',
    fontSize:16,
    fontWeight:'700'
  },
  footer:{
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    gap:8,
    top:90,
    
  },
  footerText:{
    color:'#7E7E7E',
    fontSize:13
  },
  dot:{
    color:'#7E7E7E',
    fontSize:13,
    marginHorizontal:6
  }
});

export default Number
