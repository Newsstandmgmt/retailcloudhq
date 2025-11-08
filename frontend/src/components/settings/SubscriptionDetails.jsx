import { useState, useEffect } from 'react';
import { storeSubscriptionsAPI, storeTemplatesAPI, subscriptionPaymentsAPI } from '../../services/api';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';

const SubscriptionDetails = () => {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  useEffect(() => {
    if (selectedStore) {
      loadSubscriptionDetails();
    }
  }, [selectedStore]);

  const loadSubscriptionDetails = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      // Get subscription details with features already included
      const subscriptionRes = await storeSubscriptionsAPI.getByStore(selectedStore.id);
      const subscriptionData = subscriptionRes.data.subscription;
      
      // If subscription record exists, use it
      if (subscriptionData) {
        setSubscription(subscriptionData);
      } 
      // If no subscription record but template_id is set, get template data
      else if (selectedStore.template_id) {
        try {
          const templateRes = await storeTemplatesAPI.getById(selectedStore.template_id);
          const template = templateRes.data.template;
          
          // Create a subscription-like object from template
          const templateSubscription = {
            template_id: template.id,
            template_name: template.name,
            base_price: template.price_per_month || 0,
            total_monthly_price: template.price_per_month || 0,
            billing_cycle: template.billing_cycle || 'monthly',
            status: 'active',
            auto_renew: true,
            features: template.features || [],
            template_feature_keys: template.feature_keys || [],
            addon_feature_keys: []
          };
          
          setSubscription(templateSubscription);
          setTemplateData(template);
        } catch (templateError) {
          console.error('Error loading template data:', templateError);
        }
      }
      } catch (error) {
        console.error('Error loading subscription details:', error);
        // If subscription not found, that's okay - store might not have one yet
        if (error.response?.status !== 404) {
          alert('Error loading subscription details: ' + (error.response?.data?.error || error.message));
        }
      } finally {
        setLoading(false);
      }
      
      // Load payment history
      loadPaymentHistory();
    };
    
    const loadPaymentHistory = async () => {
      if (!selectedStore) return;
      
      setPaymentsLoading(true);
      try {
        // Try to get payments by store
        const paymentsRes = await subscriptionPaymentsAPI.getByStore(selectedStore.id);
        setPayments(paymentsRes.data.payments || []);
      } catch (error) {
        console.error('Error loading payment history:', error);
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d8659]"></div>
        <p className="mt-4 text-gray-600">Loading subscription details...</p>
      </div>
    );
  }

  if (!subscription && !selectedStore?.template_id) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <h3 className="font-semibold mb-2">No Active Subscription</h3>
          <p className="text-sm">
            This store does not have an active subscription plan. Please contact your administrator to assign a subscription plan.
          </p>
        </div>
      </div>
    );
  }

  // Get features from subscription - they're already included with full details
  const allFeatures = subscription.features || [];
  const templateFeatures = allFeatures.filter(f => !f.is_addon);
  const addonFeatures = allFeatures.filter(f => f.is_addon);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Subscription Details</h2>
        <p className="text-gray-600 mt-1">
          View your current subscription plan, features, and billing information
        </p>
      </div>

      {/* Subscription Overview Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {subscription.template_name || 'No Plan Assigned'}
            </h3>
            {subscription.template_name && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>
                  <strong>Status:</strong>{' '}
                  <span className={`px-2 py-1 rounded text-xs ${
                    subscription.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : subscription.status === 'suspended'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {subscription.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </span>
                <span>
                  <strong>Auto-Renew:</strong>{' '}
                  {subscription.auto_renew ? (
                    <span className="text-green-600">Enabled</span>
                  ) : (
                    <span className="text-gray-400">Disabled</span>
                  )}
                </span>
              </div>
            )}
          </div>
          {subscription.total_monthly_price && (
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">
                ${parseFloat(subscription.total_monthly_price).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 capitalize">
                per {subscription.billing_cycle || 'month'}
              </p>
            </div>
          )}
        </div>

        {/* Billing Information */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-500">Next Billing Date</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(subscription.next_billing_date)}
            </p>
          </div>
          {subscription.start_date && (
            <div>
              <p className="text-sm text-gray-500">Subscription Start</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(subscription.start_date)}
              </p>
            </div>
          )}
        </div>

        {/* Pricing Breakdown */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium text-gray-700 mb-2">Pricing Breakdown:</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Base Plan Price:</span>
              <span className="font-medium">${parseFloat(subscription.base_price || 0).toFixed(2)}</span>
            </div>
            {subscription.feature_addons_total > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Feature Addons:</span>
                <span className="font-medium">+${parseFloat(subscription.feature_addons_total || 0).toFixed(2)}</span>
              </div>
            )}
            {subscription.discount_percentage > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({subscription.discount_percentage}%):</span>
                <span>-${(parseFloat(subscription.total_monthly_price || 0) * subscription.discount_percentage / 100).toFixed(2)}</span>
              </div>
            )}
            {subscription.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount Amount:</span>
                <span>-${parseFloat(subscription.discount_amount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
              <span>Total Monthly Cost:</span>
              <span className="text-blue-600 text-lg">${parseFloat(subscription.total_monthly_price || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features Included */}
      {allFeatures.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Features Included ({allFeatures.length})
          </h3>
          
          {/* Template Features */}
          {templateFeatures.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Included in Plan ({templateFeatures.length}):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {templateFeatures.map((feature) => (
                  <div
                    key={feature.id || feature.feature_key}
                    className="p-2 bg-green-50 border border-green-200 rounded"
                  >
                    <div className="font-medium text-sm text-green-900">
                      {feature.feature_name || feature.feature_key?.replace(/_/g, ' ')}
                    </div>
                    {feature.description && (
                      <div className="text-xs text-green-700 mt-1">
                        {feature.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addon Features */}
          {addonFeatures.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Additional Features (Addons) ({addonFeatures.length}):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {addonFeatures.map((feature) => (
                  <div
                    key={feature.id || feature.feature_key}
                    className="p-2 bg-blue-50 border border-blue-200 rounded"
                  >
                    <div className="font-medium text-sm text-blue-900">
                      {feature.feature_name || feature.feature_key?.replace(/_/g, ' ')}
                    </div>
                    {feature.description && (
                      <div className="text-xs text-blue-700 mt-1">
                        {feature.description}
                      </div>
                    )}
                    {feature.price_per_month > 0 && (
                      <div className="text-xs text-blue-600 mt-1 font-medium">
                        Addon: +${parseFloat(feature.price_per_month || 0).toFixed(2)}/mo
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Billing Cycle</p>
            <p className="font-medium text-gray-900 capitalize">
              {subscription.billing_cycle || 'Monthly'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Subscription ID</p>
            <p className="font-medium text-gray-900 font-mono text-xs">
              {subscription.id}
            </p>
          </div>
          {subscription.last_billed_date && (
            <div>
              <p className="text-gray-500">Last Billed</p>
              <p className="font-medium text-gray-900">
                {formatDate(subscription.last_billed_date)}
              </p>
            </div>
          )}
        </div>

        {subscription.auto_renew && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-900">Auto-Renewal Enabled</p>
                <p className="text-xs text-green-700">
                  Your subscription will automatically renew on {formatDate(subscription.next_billing_date)}. You will be billed ${parseFloat(subscription.total_monthly_price || 0).toFixed(2)}.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
        </div>
        
        {paymentsLoading ? (
          <div className="text-center py-8 text-gray-500">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No payment history found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Billing Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(payment.payment_date).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'short', day: 'numeric' 
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {new Date(payment.billing_period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(payment.billing_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${parseFloat(payment.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">
                      {payment.payment_method}
                      {payment.check_number && ` (Check #${payment.check_number})`}
                      {payment.transaction_id && ` (Txn: ${payment.transaction_id})`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionDetails;

