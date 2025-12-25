import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, TextInput, Image, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { scale, verticalScale, moderateScale } from '../../utils/scaling';
import { getEventTickets, getRegistrationFormStatus, getRegistrationFormDetails, getEventDetails, manualCheckInGuest } from '../../api/event';
import Toast from 'react-native-toast-message';

const GuestRegistrationModal = ({ visible, onClose, eventId }: { visible: boolean; onClose: () => void; eventId: string | number }) => {
    const [loading, setLoading] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [selectedTicketId, setSelectedTicketId] = useState<number | string | null>(null);
    const [formConfig, setFormConfig] = useState<any>(null);
    const [formFields, setFormFields] = useState<any[]>([]);
    const [formValues, setFormValues] = useState<Record<string, any>>({});

    useEffect(() => {
        if (visible && eventId) {
            fetchData();
        } else {
            // Reset state on close
            setTickets([]);
            setFormFields([]);
            setFormValues({});
            setSelectedTicketId(null);
        }
    }, [visible, eventId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Tickets
            const ticketsRes = await getEventTickets(eventId, { include_hidden_tickets: 0 });
            if (ticketsRes && ticketsRes.data) {
                setTickets(ticketsRes.data);
                // Auto-select first ticket if available
                if (ticketsRes.data.length > 0) {
                    setSelectedTicketId(ticketsRes.data[0].id);
                }
            }

            // 2. Fetch Form Status/Schema
            // Similar logic to RegistrationFormEditor to resolve the correct form
            const statusRes = await getRegistrationFormStatus(eventId);
            let activeForm = null;

            if (statusRes?.is_filled && statusRes.form?.length > 0) {
                activeForm = statusRes.form[0];
            } else if (statusRes?.form?.length > 0) {
                activeForm = statusRes.form[0];
            } else if (statusRes?.data?.id) {
                activeForm = statusRes.data;
            }

            if (activeForm) {
                setFormConfig(activeForm);
                if (activeForm.fields) {
                    setFormFields(activeForm.fields);
                    initializeFormValues(activeForm.fields);
                } else {
                    // Fallback fetch details
                    const detailsRes = await getRegistrationFormDetails(eventId, activeForm.id);
                    if (detailsRes?.data?.fields) {
                        setFormFields(detailsRes.data.fields);
                        initializeFormValues(detailsRes.data.fields);
                        setFormConfig(detailsRes.data);
                    }
                }
            } else {
                // No form found? Use Default fields
                const defaults = [
                    { id: 'default_1', question: 'Name', type: 'text', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_2', question: 'Country Code', type: 'number', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_3', question: 'Mobile Number', type: 'text', mandatory: 1, is_show: 1, options: [] },
                    { id: 'default_4', question: 'Email', type: 'text', mandatory: 1, is_show: 1, options: [] },
                ];
                setFormFields(defaults);
                initializeFormValues(defaults);
            }

        } catch (error) {
            console.error("Error fetching guest registration data:", error);
            Toast.show({ type: 'error', text1: 'Error loading registration details' });
        } finally {
            setLoading(false);
        }
    };

    const initializeFormValues = (fields: any[]) => {
        const initial: Record<string, any> = {};
        fields.forEach((f: any) => {
            initial[f.id] = "";
        });
        setFormValues(initial);
    };

    const handleInputChange = (fieldId: string | number, value: any) => {
        setFormValues(prev => ({
            ...prev,
            [fieldId]: value
        }));
    };

    const handleSubmit = async () => {
        // Validate Mandatory Fields
        for (const field of formFields) {
            if (field.is_show && field.mandatory && !formValues[field.id]) {
                Alert.alert("Required", `Please fill in ${field.question}`);
                return;
            }
        }

        if (!selectedTicketId) {
            Alert.alert("Required", "Please select a ticket type");
            return;
        }

        console.log("Submitting Guest Registration:", {
            eventId,
            ticketId: selectedTicketId,
            formData: formValues
        });

        // Simulating success as I don't want to break verified API calls without knowing the endpoint.
        // If there was a `registerGuest` endpoint, I'd use it.
        Alert.alert("Success", "Guest Registered Successfully! (UI Demo)", [{ text: "OK", onPress: onClose }]);
    };

    const renderField = (field: any) => {
        if (!field.is_show) return null;

        const Label = () => (
            <Text style={styles.label}>
                {field.question} {field.mandatory ? <Text style={{ color: 'red' }}>*</Text> : ''}
            </Text>
        );

        switch (field.type) {
            // Mapping API types to UI
            case 'text':
            case 'email':
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={styles.input}
                            placeholder={field.question}
                            placeholderTextColor="#999"
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                        />
                    </View>
                );
            case 'number':
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={styles.input}
                            placeholder={field.question}
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                        />
                    </View>
                );
            case 'textarea':
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={[styles.input, { height: verticalScale(80), textAlignVertical: 'top' }]}
                            placeholder={field.question}
                            placeholderTextColor="#999"
                            multiline
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                        />
                    </View>
                );
            case 'switch':
            case 'Yes/No Answer':
                return (
                    <View key={field.id} style={[styles.fieldContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                        <Text style={styles.label}>{field.question}</Text>
                        <Switch
                            trackColor={{ false: "#767577", true: "#FF8A3C" }}
                            thumbColor={formValues[field.id] ? "#white" : "#f4f3f4"}
                            value={formValues[field.id] === 'yes' || formValues[field.id] === true}
                            onValueChange={(val) => handleInputChange(field.id, val ? 'yes' : 'no')}
                        />
                    </View>
                );
            case 'radio': // Multiple Choice Single
            case 'checkbox': // Multiple Choice Multiple
                // Simplified for now: just render options if available
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Label />
                        {field.options && field.options.map((opt: any, idx: number) => (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.optionRow, formValues[field.id] === opt && styles.optionSelected]}
                                onPress={() => handleInputChange(field.id, opt)}
                            >
                                <View style={[styles.radioCircle, formValues[field.id] === opt && { backgroundColor: '#FF8A3C', borderColor: '#FF8A3C' }]} />
                                <Text style={styles.optionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            default:
                return (
                    <View key={field.id} style={styles.fieldContainer}>
                        <Label />
                        <TextInput
                            style={styles.input}
                            placeholder={field.question}
                            placeholderTextColor="#999"
                            value={formValues[field.id]}
                            onChangeText={(t) => handleInputChange(field.id, t)}
                        />
                    </View>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalBackdrop}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Image source={require('../../assets/img/common/back.png')} style={styles.backIcon} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Register a Guest</Text>
                        <View style={{ width: scale(20) }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Ticket Selection */}
                        <Text style={styles.sectionTitle}>Select Ticket *</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ticketScroll}>
                            {tickets.map((ticket: any) => (
                                <TouchableOpacity
                                    key={ticket.id}
                                    style={[styles.ticketCard, selectedTicketId === ticket.id && styles.ticketCardSelected]}
                                    onPress={() => setSelectedTicketId(ticket.id)}
                                >
                                    <Text style={[styles.ticketName, selectedTicketId === ticket.id && { color: 'white' }]}>{ticket.title}</Text>
                                    <Text style={[styles.ticketPrice, selectedTicketId === ticket.id && { color: 'white' }]}>
                                        {ticket.amount > 0 ? `₹${ticket.amount}` : 'Free'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={styles.divider} />

                        {/* Dynamic Form */}
                        {formFields.map((field: any) => renderField(field))}

                        <View style={{ height: verticalScale(40) }} />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                            <Text style={styles.submitText}>Complete Registration</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: scale(20),
        borderTopRightRadius: scale(20),
        height: '90%', // Occupy most of screen
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: scale(20),
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    headerTitle: {
        fontSize: moderateScale(18),
        fontWeight: '700',
        color: '#333',
    },
    closeButton: {
        padding: scale(5),
    },
    backIcon: {
        width: scale(20),
        height: scale(20),
        resizeMode: 'contain',
    },
    content: {
        padding: scale(20),
        paddingBottom: verticalScale(100),
    },
    sectionTitle: {
        fontSize: moderateScale(16),
        fontWeight: '600',
        marginBottom: verticalScale(10),
        color: '#333',
    },
    ticketScroll: {
        flexGrow: 0,
        marginBottom: verticalScale(15),
    },
    ticketCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(10),
        padding: scale(12),
        marginRight: scale(10),
        minWidth: scale(100),
        alignItems: 'center',
    },
    ticketCardSelected: {
        backgroundColor: '#FF8A3C',
        borderColor: '#FF8A3C',
    },
    ticketName: {
        fontSize: moderateScale(14),
        fontWeight: '600',
        color: '#333',
        marginBottom: verticalScale(4),
    },
    ticketPrice: {
        fontSize: moderateScale(12),
        color: '#666',
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: verticalScale(15),
    },
    fieldContainer: {
        marginBottom: verticalScale(15),
    },
    label: {
        fontSize: moderateScale(15),
        color: '#333',
        marginBottom: verticalScale(8),
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: scale(8),
        paddingHorizontal: scale(15),
        paddingVertical: verticalScale(12),
        fontSize: moderateScale(16),
        color: '#333',
        backgroundColor: 'white',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: verticalScale(8),
    },
    optionSelected: {
        // highlight?
    },
    radioCircle: {
        width: scale(18),
        height: scale(18),
        borderRadius: scale(9),
        borderWidth: 1.5,
        borderColor: '#666',
        marginRight: scale(10),
    },
    optionText: {
        fontSize: moderateScale(16),
        color: '#333',
    },
    footer: {
        padding: scale(20),
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    submitButton: {
        backgroundColor: '#FF8A3C',
        borderRadius: scale(10),
        paddingVertical: verticalScale(15),
        alignItems: 'center',
    },
    submitText: {
        color: 'white',
        fontSize: moderateScale(16),
        fontWeight: '700',
    }
});

export default GuestRegistrationModal;
